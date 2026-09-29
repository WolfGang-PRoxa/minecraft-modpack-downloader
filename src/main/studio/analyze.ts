import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { join } from 'node:path'
import type { Entry, ZipFile } from 'yauzl'
import { CURSEFORGE_INSTANCE_FILE } from '../../shared/config'
import type { ZipAnalysis } from '../../shared/studio'
import { readJson, writeJsonAtomic } from '../fsutil'
import { findRootPrefix, openEntry, openZip, readEntries } from '../zip'

/** Limite de GitHub pour un fichier de release. */
export const MAX_ASSET_SIZE = 2 * 1024 ** 3 - 1

/** Erreur destinée à l'auteur du modpack : son message est affiché tel quel. */
export class StudioError extends Error {}

export function describeError(err: unknown): string {
  if (err instanceof StudioError) return err.message
  const code = (err as NodeJS.ErrnoException)?.code
  if (code === 'EBUSY' || code === 'EPERM' || code === 'EACCES') {
    return 'Un fichier est utilisé par un autre programme (copie en cours ?). Réessaie dans un instant.'
  }
  if (code === 'ENOSPC') return 'Espace disque insuffisant.'
  return err instanceof Error ? err.message : String(err)
}

/** Dossiers de données personnelles qui n'ont rien à faire dans un modpack publié. */
const PLAYER_DATA_DIRS = ['logs', 'crash-reports', 'screenshots', 'backups']

async function readEntryText(zip: ZipFile, entry: Entry): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of await openEntry(zip, entry)) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8').replace(/^﻿/, '')
}

export async function sha256File(file: string): Promise<string> {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(file, { highWaterMark: 1024 * 1024 })) hash.update(chunk as Buffer)
  return hash.digest('hex')
}

/**
 * Vérifie qu'un zip contient bien une instance CurseForge et en extrait les infos affichées aux joueurs.
 * Le calcul de l'empreinte ne se fait qu'une fois le contenu validé.
 */
export async function analyzeZip(file: string, size: number): Promise<ZipAnalysis> {
  if (size > MAX_ASSET_SIZE) {
    throw new StudioError('Zip de plus de 2 Go : GitHub refuse les fichiers de cette taille.')
  }

  let zip: ZipFile
  let entries: Entry[]
  try {
    zip = await openZip(file)
  } catch {
    throw new StudioError('Zip illisible ou incomplet (copie encore en cours ?).')
  }
  const info: Omit<ZipAnalysis, 'sha256'> = { minecraftVersion: null, modLoader: null, modCount: null, warnings: [] }
  try {
    try {
      entries = await readEntries(zip)
    } catch {
      throw new StudioError('Zip corrompu : son contenu est illisible.')
    }

    const prefix = findRootPrefix(entries, CURSEFORGE_INSTANCE_FILE)
    if (prefix === null) {
      const isExport = entries.some((e) => /^([^/]+\/)?manifest\.json$/.test(e.fileName))
      throw new StudioError(
        isExport
          ? 'C’est un export CurseForge (manifest.json) : zippe plutôt le dossier de l’instance, ou utilise « Ajouter depuis CurseForge ».'
          : 'minecraftinstance.json introuvable : ce zip ne contient pas une instance CurseForge.'
      )
    }

    const instanceEntry = entries.find((e) => e.fileName === prefix + CURSEFORGE_INSTANCE_FILE)!
    let instance: Record<string, unknown>
    try {
      instance = JSON.parse(await readEntryText(zip, instanceEntry)) as Record<string, unknown>
    } catch {
      throw new StudioError('minecraftinstance.json est illisible dans ce zip.')
    }
    const loader = instance.baseModLoader as { name?: unknown } | null | undefined
    info.minecraftVersion = typeof instance.gameVersion === 'string' ? instance.gameVersion : null
    info.modLoader = typeof loader?.name === 'string' ? loader.name : null

    const names = entries
      .filter((e) => e.fileName.startsWith(prefix))
      .map((e) => e.fileName.slice(prefix.length))
    info.modCount = names.filter((n) => /^mods\/[^/]+\.jar$/i.test(n)).length

    const worlds = new Set(names.map((n) => /^saves\/([^/]+)\//i.exec(n)?.[1]).filter(Boolean))
    if (worlds.size > 0) {
      info.warnings.push(
        `${worlds.size} monde${worlds.size > 1 ? 's' : ''} inclus (dossier saves) : ${worlds.size > 1 ? 'ils seront installés' : 'il sera installé'} chez les joueurs.`
      )
    }
    const personal = PLAYER_DATA_DIRS.filter((dir) => names.some((n) => n.toLowerCase().startsWith(`${dir}/`)))
    if (personal.length > 0) {
      info.warnings.push(`Contient ${personal.join(', ')} : inutile pour les joueurs, ça alourdit le zip.`)
    }
    if (info.modCount === 0) info.warnings.push('Aucun mod dans le dossier mods.')
  } finally {
    zip.close()
  }

  return { ...info, sha256: await sha256File(file) }
}

interface CacheFile {
  version: 1
  entries: Record<string, ZipAnalysis>
}

/**
 * Résultats d'analyse conservés entre deux lancements : calculer l'empreinte d'un zip de 1 Go prend
 * plusieurs secondes. La clé ne contient pas le nom du fichier, pour survivre au rangement.
 */
export class AnalysisCache {
  static readonly FILE_NAME = '.studio-cache.json'

  private used = new Set<string>()
  private dirty = false

  private constructor(
    private readonly file: string,
    private entries: Record<string, ZipAnalysis>
  ) {}

  static async load(workspaceDir: string): Promise<AnalysisCache> {
    const file = join(workspaceDir, AnalysisCache.FILE_NAME)
    const data = await readJson<CacheFile>(file)
    return new AnalysisCache(file, data?.version === 1 && data.entries ? data.entries : {})
  }

  static key(folder: string, size: number, mtimeMs: number): string {
    return `${folder.toLowerCase()}|${size}|${Math.floor(mtimeMs)}`
  }

  beginScan(): void {
    this.used.clear()
  }

  get(key: string): ZipAnalysis | null {
    this.used.add(key)
    return this.entries[key] ?? null
  }

  set(key: string, analysis: ZipAnalysis): void {
    this.used.add(key)
    this.entries[key] = analysis
    this.dirty = true
  }

  /** Oublie les zips qui n'existent plus et enregistre si besoin. */
  async endScan(): Promise<void> {
    for (const key of Object.keys(this.entries)) {
      if (!this.used.has(key)) {
        delete this.entries[key]
        this.dirty = true
      }
    }
    if (!this.dirty) return
    this.dirty = false
    await writeJsonAtomic(this.file, { version: 1, entries: this.entries } satisfies CacheFile).catch(() => {})
  }
}
