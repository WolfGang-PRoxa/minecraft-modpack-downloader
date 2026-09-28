/** Contenu de l'asset `modpack.json` attaché à chaque release de modpack. */
export interface ModpackManifest {
  schema: 1
  id: string
  name: string
  version: string
  minecraftVersion: string | null
  modLoader: string | null
  modCount: number | null
  description: string
  archive: string
  archiveSize: number
  archiveSha256: string | null
  cover: string | null
  author: string | null
  createdAt: string
}

/** Une version publiée d'un modpack (= une release GitHub). */
export interface ModpackVersion {
  id: string
  name: string
  version: string
  minecraftVersion: string | null
  modLoader: string | null
  modCount: number | null
  description: string
  tag: string
  notes: string
  prerelease: boolean
  publishedAt: string
  archiveUrl: string
  archiveSize: number
  archiveSha256: string | null
  coverUrl: string | null
  releaseUrl: string
}

/** Un modpack et toutes ses versions, de la plus récente à la plus ancienne. */
export interface Modpack {
  id: string
  latest: ModpackVersion
  versions: ModpackVersion[]
}

export interface AppUpdateInfo {
  version: string
  notes: string
  releaseUrl: string
  installerUrl: string | null
  installerSize: number
}

export interface Catalog {
  modpacks: Modpack[]
  appUpdate: AppUpdateInfo | null
  fetchedAt: string | null
  /** Renseigné quand GitHub n'a pas pu être joint : le catalogue vient alors du cache. */
  error: string | null
}

/** Contenu du fichier marqueur déposé dans une instance installée. */
export interface InstanceMarker {
  id: string
  version: string
  tag: string
  installedAt: string
  /** Entrées de premier niveau fournies par le modpack (pour nettoyer lors d'une mise à jour). */
  managedEntries: string[]
}

export interface InstalledModpack extends InstanceMarker {
  instanceName: string
  instancePath: string
}

export type CurseForgeFlavor = 'overwolf' | 'standalone'

export interface CurseForgeStatus {
  installed: boolean
  flavor: CurseForgeFlavor | null
  instancesDir: string
  instancesDirSource: 'settings' | 'curseforge' | 'default'
  instancesDirExists: boolean
}

export interface Settings {
  /** Dossier Instances choisi manuellement (null = détection automatique). */
  instancesDir: string | null
  openCurseForgeAfterInstall: boolean
}

export type InstallPhase = 'preparing' | 'downloading' | 'verifying' | 'extracting' | 'finalizing'

export interface InstallProgress {
  id: string
  version: string
  phase: InstallPhase
  /** Octets traités dans la phase courante. */
  done: number
  /** Total de la phase courante (0 si inconnu). */
  total: number
  bytesPerSecond: number
}

export type InstallResult =
  | { ok: true; installed: InstalledModpack; updated: boolean; curseForgeLaunched: boolean }
  | { ok: false; cancelled: boolean; error: string }

export interface AppUpdateProgress {
  done: number
  total: number
}

/** API exposée au renderer par le preload (`window.api`). */
export interface RendererApi {
  getCatalog(force?: boolean): Promise<Catalog>
  getInstalled(): Promise<InstalledModpack[]>
  install(version: ModpackVersion): Promise<InstallResult>
  cancelInstall(id: string): Promise<void>
  onInstallProgress(listener: (progress: InstallProgress) => void): () => void
  getCurseForgeStatus(): Promise<CurseForgeStatus>
  launchCurseForge(): Promise<boolean>
  getSettings(): Promise<Settings>
  updateSettings(patch: Partial<Settings>): Promise<Settings>
  pickInstancesDir(): Promise<Settings | null>
  openPath(path: string): Promise<void>
  openExternal(url: string): Promise<void>
  getAppVersion(): Promise<string>
  installAppUpdate(update: AppUpdateInfo): Promise<{ ok: boolean; error?: string }>
  onAppUpdateProgress(listener: (progress: AppUpdateProgress) => void): () => void
  minimizeWindow(): void
  toggleFullscreen(): void
  closeWindow(): void
  onFullscreenChange(listener: (fullscreen: boolean) => void): () => void
}
