// Types du Modpack Studio : l'outil de l'auteur pour ranger ses zips et les publier sur GitHub.
import type { CredentialSource, RepoRef, UserRole } from './types'

export interface StudioSettings {
  /** Dossier qui contient un sous-dossier par modpack (null tant qu'il n'a pas été choisi). */
  workspaceDir: string | null
  defaultWorkspaceDir: string
  /** Rôle et dépôt choisis dans l'application (Paramètres → Utilisation). */
  role: UserRole | null
  repo: RepoRef
}

/** Ce qu'on lit dans un zip de modpack. */
export interface ZipAnalysis {
  sha256: string
  minecraftVersion: string | null
  modLoader: string | null
  modCount: number | null
  /** Empreinte des mods du zip, pour reconnaître cette version dans un profil CurseForge. */
  modsSignature: string | null
  warnings: string[]
}

export type RemoteStatus = 'published' | 'create' | 'update' | 'blocked' | 'unknown'

export interface VersionView {
  number: number
  fileName: string
  path: string
  size: number
  modifiedAt: string
  analysis: ZipAnalysis | null
  /** Zip inutilisable : il ne sera pas publié. */
  error: string | null
  notes: string
  remote: RemoteStatus
  /** Ce qui changera sur GitHub à la prochaine publication. */
  changes: string[]
}

/** Zip déposé dans le dossier mais pas encore numéroté. */
export interface PendingZip {
  fileName: string
  size: number
  modifiedAt: string
  /** Zip inutilisable : il ne sera pas rangé. */
  error: string | null
  warnings: string[]
}

/** Version présente sur GitHub dont le zip n'existe plus sur le PC. */
export interface RemoteOnlyVersion {
  tag: string
  version: string
  url: string
  draft: boolean
}

export interface PackView {
  folder: string
  dir: string
  id: string
  name: string
  description: string
  coverUrl: string | null
  /** Versions numérotées, de la plus récente à la plus ancienne. */
  versions: VersionView[]
  pending: PendingZip[]
  remoteOnly: RemoteOnlyVersion[]
  /** Erreurs qui empêchent toute publication de ce modpack. */
  errors: string[]
  nextVersion: number
}

export interface GitHubStatus {
  state: 'ok' | 'no-token' | 'error' | 'unchecked'
  repo: string
  repoUrl: string
  login: string | null
  tokenSource: CredentialSource | null
  repoPrivate: boolean | null
  canPush: boolean | null
  error: string | null
  checkedAt: string | null
}

export type SyncActionKind = 'create' | 'update' | 'delete'

export interface SyncAction {
  kind: SyncActionKind
  tag: string
  packId: string
  label: string
  details: string[]
  warnings: string[]
  uploadBytes: number
}

export interface SyncPlan {
  actions: SyncAction[]
  /** Empreinte du plan : la publication est refusée si le dossier a changé entre-temps. */
  fingerprint: string
  warnings: string[]
  uploadBytes: number
  /** Zips pas encore rangés, ignorés par la publication. */
  pendingZips: number
}

/** Modpack publié sur GitHub dont le dossier n'existe plus : il sera retiré. */
export interface OrphanPack {
  id: string
  name: string
  versions: string[]
  /** Tags de ses releases, pour les retirer sans attendre la publication. */
  tags: string[]
}

export interface StudioOverview {
  settings: StudioSettings
  workspaceExists: boolean
  packs: PackView[]
  /** Zips posés à la racine du dossier, hors de tout modpack. */
  strayZips: string[]
  orphanPacks: OrphanPack[]
  /** Nombre de fichiers que « Ranger » renommerait. */
  toRange: number
  github: GitHubStatus
  /** null tant que GitHub n'a pas pu être lu. */
  plan: SyncPlan | null
}

export interface RangerRename {
  from: string
  to: string
  number: number
  /** Nouveau zip numéroté, ou zip déjà numéroté qu'on renomme au nom du dossier. */
  kind: 'new' | 'rename'
  warning: string | null
}

export interface RangerPackPlan {
  folder: string
  name: string
  renames: RangerRename[]
  errors: string[]
}

export interface RangerPlan {
  packs: RangerPackPlan[]
  total: number
}

/** Ordre choisi pour les zips à ranger, par dossier de modpack. */
export type RangerOrders = Record<string, string[]>

export type PublishStepStatus = 'pending' | 'running' | 'done' | 'error' | 'skipped'

export interface PublishProgress {
  steps: Array<{ tag: string; kind: SyncActionKind; label: string; status: PublishStepStatus; error?: string }>
  current: { text: string; done: number; total: number; bytesPerSecond: number } | null
}

export type PublishResult =
  | { ok: true; done: number }
  | { ok: false; cancelled: boolean; error: string; done: number }

export interface CurseForgeInstanceInfo {
  name: string
  path: string
  minecraftVersion: string | null
  modLoader: string | null
  modCount: number | null
  lastPlayed: string | null
}

export interface ZipProgress {
  done: number
  total: number
}

export type ActionResult = { ok: true } | { ok: false; error: string }

/** Fichier d'un zip de modpack, chemin relatif au dossier de l'instance. */
export interface ZipFileEntry {
  path: string
  size: number
}

/** Mod d'un zip : un .jar du dossier mods, avec son nom CurseForge quand minecraftinstance.json le connaît. */
export interface ZipMod {
  fileName: string
  size: number
  /** `.jar.disabled` : désactivé dans CurseForge, ignoré par le jeu. */
  disabled: boolean
  name: string | null
  author: string | null
  /** Page CurseForge du mod. */
  url: string | null
}

export interface ZipContents {
  /** Dossier de l'instance dans le zip ('' : à la racine). */
  root: string
  files: ZipFileEntry[]
  mods: ZipMod[]
}

export type ZipEntryPreview =
  | { kind: 'text'; text: string; truncated: boolean }
  | { kind: 'image'; dataUrl: string }
  | { kind: 'binary' }
  | { kind: 'too-large' }

export type ImportResult = { ok: true; zips: number; cover: boolean; ignored: string[] } | { ok: false; error: string }

/** API exposée à la fenêtre du studio par son preload (`window.studio`). */
export interface StudioApi {
  getOverview(options?: { refreshRemote?: boolean }): Promise<StudioOverview>
  onChanged(listener: () => void): () => void
  onAnalyzing(listener: (fileName: string | null) => void): () => void

  pickWorkspaceDir(): Promise<boolean>
  useDefaultWorkspace(): Promise<ActionResult>

  createPack(name: string): Promise<ActionResult>
  updatePackInfo(folder: string, info: { name: string; description: string }): Promise<ActionResult>
  pickCover(folder: string): Promise<ActionResult>
  removeCover(folder: string): Promise<ActionResult>
  setNotes(folder: string, version: number, notes: string): Promise<ActionResult>
  importFiles(folder: string, paths: string[]): Promise<ImportResult>

  getRangerPlan(orders?: RangerOrders): Promise<RangerPlan>
  applyRanger(orders?: RangerOrders): Promise<ActionResult & { renamed?: number }>

  publish(fingerprint: string): Promise<PublishResult>
  cancelPublish(): Promise<void>
  onPublishProgress(listener: (progress: PublishProgress) => void): () => void

  /** Zip à la corbeille et release retirée de GitHub. */
  deleteVersion(folder: string, version: number): Promise<PublishResult>
  /** Dossier à la corbeille et toutes les releases du modpack retirées de GitHub. */
  deletePack(folder: string): Promise<PublishResult>
  /** Releases sans zip dans le dossier, retirées sans attendre la publication. */
  deleteReleases(tags: string[]): Promise<PublishResult>

  listInstances(): Promise<{ dir: string; instances: CurseForgeInstanceInfo[] }>
  zipInstance(folder: string, instancePath: string, includeSaves: boolean): Promise<ActionResult & { fileName?: string }>
  cancelZip(): Promise<void>
  onZipProgress(listener: (progress: ZipProgress) => void): () => void

  /** Contenu d'un zip du dossier d'un modpack (version rangée ou zip déposé). */
  getZipContents(folder: string, fileName: string): Promise<ZipContents>
  previewZipEntry(folder: string, fileName: string, path: string): Promise<ZipEntryPreview>

  openPath(path: string): Promise<void>
  getPathForFile(file: File): string
}
