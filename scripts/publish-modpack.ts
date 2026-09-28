// Publie une instance CurseForge comme release de modpack sur GitHub.
//
//   npm run publish:modpack
//   npm run publish:modpack -- --instance "C:\...\Instances\Mon Pack" --version 1.2.0 --notes-file notes.md
//   npm run publish:modpack -- --dry-run --out ./modpack-out      (génère les fichiers sans rien publier)
//
// Options : --instance, --id, --name, --version, --description, --notes-file, --cover,
//           --exclude <chemin> (répétable), --include-saves, --prerelease, --yes, --dry-run, --out
import { confirm, editor, input, password, select } from '@inquirer/prompts'
import { ZipArchive, type ProgressData, type ZipEntryData } from 'archiver'
import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream, existsSync } from 'node:fs'
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { request } from 'node:https'
import { homedir, tmpdir } from 'node:os'
import { basename, extname, join, relative, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import {
  CURSEFORGE_INSTANCE_FILE,
  GITHUB_OWNER,
  GITHUB_REPO,
  INSTANCE_MARKER_FILE,
  MODPACK_MANIFEST_ASSET
} from '../src/shared/config'
import {
  compareVersions,
  findManifestAsset,
  isModpackManifest,
  isValidModpackId,
  modpackTag,
  parseModpackTag,
  slugify,
  type GhRelease
} from '../src/shared/releases'
import { formatLoader } from '../src/shared/format'
import type { ModpackManifest } from '../src/shared/types'

const API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`
const MAX_ASSET_SIZE = 2 * 1024 ** 3 - 1

/** Données propres à chaque joueur, jamais publiées (chemins relatifs, insensibles à la casse). */
const DEFAULT_EXCLUDES = [
  'saves',
  'screenshots',
  'logs',
  'crash-reports',
  'backups',
  'local',
  'downloads',
  '.mixin.out',
  'journeymap/data',
  'xaero',
  'xaerowaypoints',
  'xaeroworldmap',
  'usercache.json',
  'usernamecache.json',
  'command_history.txt',
  INSTANCE_MARKER_FILE
]

/** Fichiers déjà compressés : on les stocke tels quels pour aller plus vite. */
const STORED_EXTENSIONS = new Set(['.jar', '.zip', '.png', '.jpg', '.jpeg', '.ogg', '.gz', '.7z'])

const { values: args } = parseArgs({
  options: {
    instance: { type: 'string' },
    id: { type: 'string' },
    name: { type: 'string' },
    version: { type: 'string' },
    description: { type: 'string' },
    'notes-file': { type: 'string' },
    cover: { type: 'string' },
    exclude: { type: 'string', multiple: true },
    'include-saves': { type: 'boolean', default: false },
    prerelease: { type: 'boolean', default: false },
    yes: { type: 'boolean', short: 'y', default: false },
    'dry-run': { type: 'boolean', default: false },
    out: { type: 'string' }
  }
})

const dryRun = args['dry-run']!

// ---------------------------------------------------------------------------------------------
// Affichage

const c = {
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`
}

function formatBytes(bytes: number): string {
  const units = ['o', 'Ko', 'Mo', 'Go']
  let i = 0
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024
    i++
  }
  return `${bytes.toFixed(i ? 1 : 0)} ${units[i]}`
}

function progressLine(label: string, done: number, total: number): void {
  const ratio = total ? done / total : 0
  const width = 28
  const bar = '█'.repeat(Math.round(ratio * width)).padEnd(width, '░')
  process.stdout.write(`\r  ${label} ${c.green(bar)} ${(ratio * 100).toFixed(0).padStart(3)} %  ${formatBytes(done)} / ${formatBytes(total)}   `)
}

// ---------------------------------------------------------------------------------------------
// GitHub

async function loadToken(): Promise<string> {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN
  const envFile = resolve('.env')
  if (existsSync(envFile)) {
    const match = /^GITHUB_TOKEN=(.+)$/m.exec(await readFile(envFile, 'utf8'))
    if (match) return match[1].trim()
  }
  console.log(
    c.dim(
      `Il faut un jeton GitHub avec l'accès « Contents: Read and write » sur ${GITHUB_OWNER}/${GITHUB_REPO}.\n` +
        'Crée-le sur https://github.com/settings/personal-access-tokens/new (fine-grained token).'
    )
  )
  const token = (await password({ message: 'Jeton GitHub :', mask: '•' })).trim()
  if (await confirm({ message: 'Enregistrer le jeton dans .env (ignoré par git) ?', default: true })) {
    await writeFile(envFile, `GITHUB_TOKEN=${token}\n`, { flag: 'a' })
  }
  return token
}

async function github<T>(token: string | null, method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url.startsWith('http') ? url : `${API}${url}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'modpack-publisher',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`GitHub ${method} ${url} → ${res.status} ${res.statusText}\n${detail}`)
  }
  return (res.status === 204 ? undefined : await res.json()) as T
}

async function listReleases(token: string | null): Promise<GhRelease[]> {
  try {
    const releases: GhRelease[] = []
    for (let page = 1; page <= 5; page++) {
      const batch = await github<GhRelease[]>(token, 'GET', `/releases?per_page=100&page=${page}`)
      releases.push(...batch)
      if (batch.length < 100) break
    }
    return releases
  } catch (err) {
    console.log(c.dim(`(Impossible de lire les releases existantes : ${(err as Error).message.split('\n')[0]})`))
    return []
  }
}

function uploadAsset(token: string, release: GhRelease, file: string, name: string, contentType: string): Promise<void> {
  const uploadUrl = release.upload_url.replace(/\{.*\}$/, '')
  const url = new URL(`${uploadUrl}?name=${encodeURIComponent(name)}`)
  return new Promise((resolvePromise, reject) => {
    stat(file).then(({ size }) => {
      const req = request(
        url,
        {
          method: 'POST',
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
            'User-Agent': 'modpack-publisher',
            'Content-Type': contentType,
            'Content-Length': size
          }
        },
        (res) => {
          let body = ''
          res.on('data', (chunk) => (body += chunk))
          res.on('end', () => {
            process.stdout.write('\n')
            if (res.statusCode && res.statusCode < 300) resolvePromise()
            else reject(new Error(`Échec de l'envoi de ${name} (${res.statusCode}) : ${body}`))
          })
        }
      )
      req.on('error', reject)
      let sent = 0
      const stream = createReadStream(file)
      stream.on('data', (chunk) => {
        sent += chunk.length
        progressLine(`Envoi de ${name.padEnd(14).slice(0, 14)}`, sent, size)
      })
      stream.pipe(req)
    }, reject)
  })
}

// ---------------------------------------------------------------------------------------------
// Instance CurseForge

interface InstanceInfo {
  dir: string
  name: string
  minecraftVersion: string | null
  modLoader: string | null
  modCount: number | null
  profileImagePath: string | null
}

async function readInstance(dir: string): Promise<InstanceInfo> {
  const file = join(dir, CURSEFORGE_INSTANCE_FILE)
  if (!existsSync(file)) throw new Error(`${CURSEFORGE_INSTANCE_FILE} introuvable dans ${dir}`)
  const json = JSON.parse((await readFile(file, 'utf8')).replace(/^\uFEFF/, '')) as Record<string, any>
  const addons = Array.isArray(json.installedAddons) ? json.installedAddons : null
  const image = typeof json.profileImagePath === 'string' && existsSync(json.profileImagePath) ? json.profileImagePath : null
  return {
    dir,
    name: typeof json.name === 'string' ? json.name : basename(dir),
    minecraftVersion: typeof json.gameVersion === 'string' ? json.gameVersion : null,
    modLoader: typeof json.baseModLoader?.name === 'string' ? json.baseModLoader.name : null,
    modCount: addons ? addons.length : null,
    profileImagePath: image
  }
}

async function pickInstance(): Promise<string> {
  if (args.instance) return resolve(args.instance)
  const instancesDir = join(homedir(), 'curseforge', 'minecraft', 'Instances')
  const names = await readdir(instancesDir).catch(() => [] as string[])
  const choices = names
    .filter((name) => existsSync(join(instancesDir, name, CURSEFORGE_INSTANCE_FILE)))
    .map((name) => ({ name, value: join(instancesDir, name) }))
  if (choices.length === 0) {
    return resolve(await input({ message: "Chemin du dossier de l'instance CurseForge :" }))
  }
  choices.push({ name: c.dim('Autre dossier…'), value: '' })
  const picked = await select({ message: 'Quelle instance publier ?', choices })
  return picked || resolve(await input({ message: "Chemin du dossier de l'instance CurseForge :" }))
}

// ---------------------------------------------------------------------------------------------
// Archive

async function collectFiles(root: string, excludes: string[]): Promise<Array<{ path: string; rel: string; size: number }>> {
  const excluded = new Set(excludes.map((e) => e.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()))
  const files: Array<{ path: string; rel: string; size: number }> = []
  async function walk(dir: string) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      const rel = relative(root, path).replace(/\\/g, '/')
      if (excluded.has(rel.toLowerCase())) continue
      if (/^\.modpack-cover\./i.test(rel)) continue
      if (entry.isDirectory()) await walk(path)
      else if (entry.isFile()) files.push({ path, rel, size: (await stat(path)).size })
    }
  }
  await walk(root)
  return files
}

async function buildArchive(root: string, excludes: string[], destination: string): Promise<{ size: number; sha256: string; count: number }> {
  const files = await collectFiles(root, excludes)
  const total = files.reduce((sum, f) => sum + f.size, 0)
  const out = createWriteStream(destination)
  const zip = new ZipArchive({ zlib: { level: 6 }, forceZip64: total > 3.5 * 1024 ** 3 })
  let processed = 0

  const done = new Promise<void>((resolvePromise, reject) => {
    out.on('close', () => resolvePromise())
    zip.on('error', reject)
    out.on('error', reject)
  })
  zip.on('progress', (p: ProgressData) => {
    processed = p.fs.processedBytes
    progressLine('Compression      ', processed, total)
  })
  zip.pipe(out)
  for (const file of files) {
    const entry: ZipEntryData = { name: file.rel, store: STORED_EXTENSIONS.has(extname(file.rel).toLowerCase()) }
    zip.file(file.path, entry)
  }
  await zip.finalize()
  await done
  process.stdout.write('\n')

  const hash = createHash('sha256')
  for await (const chunk of createReadStream(destination)) hash.update(chunk as Buffer)
  return { size: (await stat(destination)).size, sha256: hash.digest('hex'), count: files.length }
}

// ---------------------------------------------------------------------------------------------

function nextVersion(previous: string | null): string {
  if (!previous) return '1.0.0'
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(previous)
  return match ? `${match[1]}.${match[2]}.${Number(match[3]) + 1}` : previous
}

async function fetchPreviousManifest(release: GhRelease | undefined): Promise<ModpackManifest | null> {
  const asset = release && findManifestAsset(release)
  if (!asset) return null
  try {
    const res = await fetch(asset.browser_download_url, { headers: { 'User-Agent': 'modpack-publisher' } })
    const json: unknown = await res.json()
    return isModpackManifest(json) ? json : null
  } catch {
    return null
  }
}

async function main(): Promise<void> {
  console.log(c.bold(`\n📦 Publication d'un modpack sur ${GITHUB_OWNER}/${GITHUB_REPO}${dryRun ? c.cyan(' (simulation)') : ''}\n`))

  const token = dryRun ? null : await loadToken()
  const instance = await readInstance(await pickInstance())
  console.log(
    c.dim(
      `  ${instance.name} · Minecraft ${instance.minecraftVersion ?? '?'} · ${instance.modLoader ?? 'vanilla'} · ${instance.modCount ?? '?'} mods\n`
    )
  )

  const releases = await listReleases(token)

  const id = args.id ?? (await input({ message: 'Identifiant du modpack :', default: slugify(instance.name), validate: (v) => isValidModpackId(v) || 'Lettres minuscules, chiffres et tirets uniquement.' }))
  if (!isValidModpackId(id)) throw new Error(`Identifiant invalide : ${id}`)

  const previousReleases = releases
    .map((release) => ({ release, parsed: parseModpackTag(release.tag_name) }))
    .filter((r) => r.parsed?.id === id)
    .sort((a, b) => compareVersions(b.parsed!.version, a.parsed!.version))
  const previous = previousReleases[0]
  const previousManifest = await fetchPreviousManifest(previous?.release)
  if (previous) console.log(c.dim(`  Dernière version publiée : ${previous.parsed!.version}\n`))

  const name = args.name ?? (await input({ message: 'Nom affiché :', default: previousManifest?.name ?? instance.name }))
  const version =
    args.version ??
    (await input({
      message: 'Version :',
      default: nextVersion(previous?.parsed!.version ?? null),
      validate: (v) => (/^\d[\w.+-]*$/.test(v) ? true : 'Format attendu : 1.2.0')
    }))
  const tag = modpackTag(id, version)
  if (releases.some((r) => r.tag_name === tag)) throw new Error(`La release ${tag} existe déjà.`)

  const description =
    args.description ?? (await input({ message: 'Description courte :', default: previousManifest?.description ?? '' }))

  let notes = args['notes-file'] ? await readFile(args['notes-file'], 'utf8') : null
  if (notes === null && !args.yes) {
    notes = await editor({
      message: 'Notes de version (Markdown) — un éditeur va s’ouvrir :',
      default: `## Nouveautés\n\n- \n`,
      postfix: '.md',
      waitForUserInput: false
    })
  }
  notes = (notes ?? '').trim()

  let coverPath = args.cover ?? instance.profileImagePath
  if (!args.cover && !args.yes) {
    const answer = await input({
      message: 'Image de couverture (png/jpg, 16:9 conseillé) — vide pour aucune :',
      default: coverPath ?? ''
    })
    coverPath = answer.replace(/^"|"$/g, '').trim() || null
  }
  if (coverPath && !existsSync(coverPath)) throw new Error(`Image introuvable : ${coverPath}`)

  const excludes = [...DEFAULT_EXCLUDES, ...(args.exclude ?? [])].filter(
    (e) => !(args['include-saves'] && e === 'saves')
  )

  const workDir = args.out ? resolve(args.out) : join(tmpdir(), `modpack-publish-${Date.now()}`)
  await mkdir(workDir, { recursive: true })
  const archiveName = `${id}-${version}.zip`
  const archivePath = join(workDir, archiveName)

  console.log()
  const archive = await buildArchive(instance.dir, excludes, archivePath)
  console.log(c.dim(`  ${archive.count} fichiers · ${formatBytes(archive.size)} · sha256 ${archive.sha256.slice(0, 12)}…\n`))
  if (archive.size > MAX_ASSET_SIZE) throw new Error('Le zip dépasse 2 Go, la limite de GitHub pour un fichier de release.')

  const coverName = coverPath ? `cover${extname(coverPath).toLowerCase() || '.png'}` : null
  const manifest: ModpackManifest = {
    schema: 1,
    id,
    name,
    version,
    minecraftVersion: instance.minecraftVersion,
    modLoader: instance.modLoader,
    modCount: instance.modCount,
    description,
    archive: archiveName,
    archiveSize: archive.size,
    archiveSha256: archive.sha256,
    cover: coverName,
    author: GITHUB_OWNER,
    createdAt: new Date().toISOString()
  }
  const manifestPath = join(workDir, MODPACK_MANIFEST_ASSET)
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2))
  if (coverPath && coverName) await copyFile(coverPath, join(workDir, coverName))

  const footer = [
    instance.minecraftVersion && `Minecraft ${instance.minecraftVersion}`,
    formatLoader(instance.modLoader),
    instance.modCount !== null && `${instance.modCount} mods`
  ]
    .filter(Boolean)
    .join(' · ')
  const body = `${notes}${notes ? '\n\n---\n' : ''}_${footer}_`

  console.log(`  Release   : ${c.bold(`${name} ${version}`)}  ${c.dim(`(tag ${tag})`)}`)
  console.log(`  Fichiers  : ${archiveName}, ${MODPACK_MANIFEST_ASSET}${coverName ? `, ${coverName}` : ''}`)

  if (dryRun) {
    await writeFile(join(workDir, 'release-body.md'), body)
    console.log(c.green(`\n✔ Simulation terminée. Fichiers générés dans ${workDir}\n`))
    return
  }

  if (!args.yes && !(await confirm({ message: 'Publier cette release ?', default: true }))) {
    await rm(workDir, { recursive: true, force: true })
    console.log('Annulé.')
    return
  }

  // Création en brouillon : la release n'est visible qu'une fois tous les fichiers envoyés.
  const release = await github<GhRelease>(token, 'POST', '/releases', {
    tag_name: tag,
    name: `${name} ${version}`,
    body,
    draft: true,
    prerelease: args.prerelease,
    make_latest: 'false'
  })
  try {
    await uploadAsset(token!, release, archivePath, archiveName, 'application/zip')
    await uploadAsset(token!, release, manifestPath, MODPACK_MANIFEST_ASSET, 'application/json')
    if (coverPath && coverName) {
      const type = coverName.endsWith('.png') ? 'image/png' : coverName.endsWith('.webp') ? 'image/webp' : 'image/jpeg'
      await uploadAsset(token!, release, join(workDir, coverName), coverName, type)
    }
    const published = await github<GhRelease>(token, 'PATCH', `/releases/${release.id}`, { draft: false, make_latest: 'false' })
    console.log(c.green(`\n✔ ${name} ${version} est publié : ${published.html_url}\n`))
  } catch (err) {
    await github(token, 'DELETE', `/releases/${release.id}`).catch(() => {})
    throw err
  } finally {
    if (!args.out) await rm(workDir, { recursive: true, force: true })
  }
}

main().catch((err: unknown) => {
  if (err instanceof Error && err.name === 'ExitPromptError') process.exit(130)
  console.error(c.red(`\n✖ ${err instanceof Error ? err.message : String(err)}\n`))
  process.exit(1)
})
