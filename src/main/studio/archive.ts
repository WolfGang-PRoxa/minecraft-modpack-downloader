import { ZipArchive, type ProgressData, type ZipEntryData } from 'archiver'
import { createWriteStream } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'
import { CURSEFORGE_INSTANCE_FILE, INSTANCE_MARKER_FILE } from '../../shared/config'
import type { CurseForgeInstanceInfo } from '../../shared/studio'
import { readJson, removeQuietly, renameWithRetry } from '../fsutil'
import { StudioError } from './analyze'

/** Données propres au joueur, jamais publiées (chemins relatifs à l'instance, insensibles à la casse). */
export const DEFAULT_EXCLUDES = [
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

async function countJars(dir: string): Promise<number | null> {
  const names = await readdir(join(dir, 'mods')).catch(() => null)
  return names ? names.filter((n) => n.toLowerCase().endsWith('.jar')).length : null
}

/** Instances CurseForge du dossier Instances, la plus récemment jouée en premier. */
export async function listInstances(instancesDir: string): Promise<CurseForgeInstanceInfo[]> {
  const entries = await readdir(instancesDir, { withFileTypes: true }).catch(() => [])
  const instances: CurseForgeInstanceInfo[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const path = join(instancesDir, entry.name)
    const json = await readJson<Record<string, unknown>>(join(path, CURSEFORGE_INSTANCE_FILE))
    if (!json) continue
    const loader = json.baseModLoader as { name?: unknown } | null | undefined
    const lastPlayed = typeof json.lastPlayed === 'string' && !json.lastPlayed.startsWith('0001') ? json.lastPlayed : null
    instances.push({
      name: entry.name,
      path,
      minecraftVersion: typeof json.gameVersion === 'string' ? json.gameVersion : null,
      modLoader: typeof loader?.name === 'string' ? loader.name : null,
      modCount: await countJars(path),
      lastPlayed
    })
  }
  return instances.sort(
    (a, b) => (b.lastPlayed ?? '').localeCompare(a.lastPlayed ?? '') || a.name.localeCompare(b.name, 'fr')
  )
}

async function collectFiles(root: string, excludes: string[]): Promise<Array<{ path: string; rel: string; size: number }>> {
  const excluded = new Set(excludes.map((e) => e.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()))
  const files: Array<{ path: string; rel: string; size: number }> = []
  async function walk(dir: string) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      const rel = relative(root, path).replace(/\\/g, '/')
      if (excluded.has(rel.toLowerCase())) continue
      // Image du profil déposée par l'application des joueurs.
      if (/^\.modpack-cover\./i.test(rel)) continue
      if (entry.isDirectory()) await walk(path)
      else if (entry.isFile()) files.push({ path, rel, size: (await stat(path)).size })
    }
  }
  await walk(root)
  return files
}

export interface ZipInstanceOptions {
  includeSaves: boolean
  onProgress?: (done: number, total: number) => void
  signal?: AbortSignal
}

/** Zippe une instance CurseForge (sans les données du joueur) ; le zip n'apparaît qu'une fois complet. */
export async function zipInstance(instanceDir: string, destination: string, options: ZipInstanceOptions): Promise<void> {
  const excludes = DEFAULT_EXCLUDES.filter((e) => !(options.includeSaves && e === 'saves'))
  const files = await collectFiles(instanceDir, excludes)
  if (!files.some((f) => f.rel === CURSEFORGE_INSTANCE_FILE)) {
    throw new StudioError(`${CURSEFORGE_INSTANCE_FILE} introuvable : ce dossier n’est pas une instance CurseForge.`)
  }
  const total = files.reduce((sum, f) => sum + f.size, 0)
  const partial = `${destination}.part`
  const out = createWriteStream(partial)
  const zip = new ZipArchive({ zlib: { level: 6 }, forceZip64: total > 3.5 * 1024 ** 3 })

  const finished = new Promise<void>((resolvePromise, reject) => {
    out.on('close', () => resolvePromise())
    out.on('error', reject)
    zip.on('error', reject)
  })
  const onAbort = () => {
    zip.abort()
    out.destroy(new StudioError('Création du zip annulée.'))
  }
  options.signal?.addEventListener('abort', onAbort, { once: true })
  zip.on('progress', (p: ProgressData) => options.onProgress?.(p.fs.processedBytes, total))

  try {
    zip.pipe(out)
    for (const file of files) {
      const entry: ZipEntryData = { name: file.rel, store: STORED_EXTENSIONS.has(extname(file.rel).toLowerCase()) }
      zip.file(file.path, entry)
    }
    await Promise.all([zip.finalize(), finished])
    options.signal?.throwIfAborted()
    const { size } = await stat(partial)
    if (size > 2 * 1024 ** 3 - 1) {
      throw new StudioError('Le zip dépasse 2 Go, la limite de GitHub. Retire des fichiers de l’instance (shaders, packs de ressources…).')
    }
    await renameWithRetry(partial, destination)
  } catch (err) {
    await removeQuietly(partial)
    if (options.signal?.aborted) throw new StudioError('Création du zip annulée.')
    throw err
  } finally {
    options.signal?.removeEventListener('abort', onAbort)
  }
}
