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
  /** Empreinte de l'image : permet au studio de savoir si elle a changé. */
  coverSha256?: string | null
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
  /** Dépôt d'où viennent les modpacks. */
  repo: RepoRef
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

export interface RepoRef {
  owner: string
  name: string
}

/** Récepteur : installe les modpacks. Publieur : les publie aussi, avec le Modpack Studio. */
export type UserRole = 'receiver' | 'publisher'

/** Vues de la fenêtre : la bibliothèque (tout le monde) et le studio (publieurs). */
export type AppView = 'library' | 'studio'

export interface Settings {
  /** Dossier Instances choisi manuellement (null = détection automatique). */
  instancesDir: string | null
  openCurseForgeAfterInstall: boolean
  /** La proposition de raccourci sur le bureau a déjà reçu une réponse. */
  shortcutPrompted: boolean
  /** null tant que le premier lancement n'a pas eu lieu. */
  role: UserRole | null
  /** Dépôt des modpacks : lu par l'application, géré par le studio pour un publieur. */
  repo: RepoRef
  /** Dossier des modpacks du studio (un sous-dossier par modpack). */
  workspaceDir: string | null
  /** Dernière vue affichée, rouverte au lancement suivant. */
  lastView: AppView
}

/** D'où vient la connexion GitHub : connexion faite dans l'application, ou repli sur une session existante. */
export type CredentialSource = 'login' | 'env' | 'dotenv' | 'gh'

export interface GitHubAccount {
  login: string
  avatarUrl: string | null
  source: CredentialSource
}

export interface AuthStatus {
  account: GitHubAccount | null
  error: string | null
  /** « Se connecter avec GitHub » est configuré (sinon, seul le jeton est proposé). */
  deviceLoginAvailable: boolean
}

export interface DeviceLogin {
  userCode: string
  verificationUri: string
  expiresAt: string
}

export type LoginResult = { ok: true; account: GitHubAccount } | { ok: false; cancelled: boolean; error: string }

/** Connexion GitHub, commune à l'application et au studio. */
export interface AuthApi {
  getAuthStatus(): Promise<AuthStatus>
  /** Démarre la connexion par code : ouvre github.com/login/device dans le navigateur. */
  startDeviceLogin(): Promise<{ ok: true; login: DeviceLogin } | { ok: false; error: string }>
  /** Attend que le code soit validé sur GitHub. */
  waitDeviceLogin(): Promise<LoginResult>
  cancelDeviceLogin(): Promise<void>
  loginWithToken(token: string): Promise<LoginResult>
  logout(): Promise<AuthStatus>
}

export interface RepoInfo {
  repo: RepoRef
  ownerAvatarUrl: string | null
  private: boolean
}

export type RoleResult =
  | { ok: true; settings: Settings; account: GitHubAccount | null; warning: string | null }
  | { ok: false; error: string; needsLogin: boolean }

export interface ShortcutStatus {
  /** Emplacement du raccourci sur le bureau. */
  desktopPath: string
  onDesktop: boolean
}

export type ShortcutLocation = 'desktop' | 'choose'

export type ShortcutResult = { ok: true; path: string } | { ok: false; cancelled: boolean; error?: string }

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

/** Choix du rôle, commun à l'application et au studio. */
export interface RoleApi {
  /** Passe en récepteur ; un dépôt peut être fourni pour suivre les modpacks d'un autre publieur. */
  becomeReceiver(repo: string | null): Promise<RoleResult>
  /** Passe en publieur après avoir vérifié que le compte GitHub connecté peut publier sur le dépôt. */
  becomePublisher(repo: string): Promise<RoleResult>
}

/** API exposée au renderer par le preload (`window.api`). */
export interface RendererApi extends AuthApi, RoleApi {
  /** Vue demandée au lancement (`--studio`), sinon null. */
  getLaunchView(): Promise<AppView | null>
  /** L'application a été relancée alors qu'elle tournait : relire l'état, et ouvrir la vue demandée. */
  onActivated(listener: (view: AppView | null) => void): () => void
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
  getShortcutStatus(): Promise<ShortcutStatus>
  createShortcut(location: ShortcutLocation): Promise<ShortcutResult>
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
