import { create } from 'zustand'
import { sameRepo } from '../../shared/repo'
import type {
  AppUpdateProgress,
  AppView,
  Catalog,
  CurseForgeStatus,
  InstalledModpack,
  InstallProgress,
  ModpackVersion,
  RoleResult,
  Settings,
  ShortcutLocation,
  ShortcutStatus
} from '../../shared/types'
import type { ToastItem as Toast } from './components/Toasts'

interface State {
  catalog: Catalog | null
  loading: boolean
  refreshing: boolean
  installed: InstalledModpack[]
  curseForge: CurseForgeStatus | null
  shortcut: ShortcutStatus | null
  settings: Settings | null
  appVersion: string
  fullscreen: boolean
  progress: InstallProgress | null
  busyId: string | null
  selectedId: string | null
  settingsOpen: boolean
  toasts: Toast[]
  appUpdateProgress: AppUpdateProgress | null
  /** Vue affichée : la bibliothèque, ou le studio pour un publieur. */
  view: AppView

  init(): Promise<void>
  refresh(force?: boolean): Promise<void>
  refreshLocal(): Promise<void>
  install(version: ModpackVersion): Promise<void>
  cancelInstall(): void
  launchCurseForge(): Promise<void>
  select(id: string | null): void
  setSettingsOpen(open: boolean): void
  updateSettings(patch: Partial<Settings>): Promise<void>
  pickInstancesDir(): Promise<void>
  createShortcut(location: ShortcutLocation): Promise<void>
  /**
   * Enregistre un changement de rôle réussi : la vue suit le rôle (le studio pour un publieur, la bibliothèque
   * pour un récepteur) et le catalogue est rechargé si le dépôt a changé.
   */
  applyRoleResult(result: RoleResult): Promise<void>
  setView(view: AppView): void
  openStudio(): void
  installAppUpdate(): Promise<void>
  pushToast(toast: Omit<Toast, 'id'>): void
  dismissToast(id: number): void
}

let toastSeq = 0
let initialized = false

export const useStore = create<State>((set, get) => ({
  catalog: null,
  loading: true,
  refreshing: false,
  installed: [],
  curseForge: null,
  shortcut: null,
  settings: null,
  appVersion: '',
  fullscreen: true,
  progress: null,
  busyId: null,
  selectedId: null,
  settingsOpen: false,
  toasts: [],
  appUpdateProgress: null,
  view: 'library',

  async init() {
    if (initialized) return
    initialized = true
    window.api.onInstallProgress((progress) => set({ progress }))
    window.api.onAppUpdateProgress((appUpdateProgress) => set({ appUpdateProgress }))
    window.api.onFullscreenChange((fullscreen) => set({ fullscreen }))
    window.api.onActivated((view) => {
      void get().refreshLocal()
      if (view) get().setView(view)
    })
    const [settings, appVersion, launchView] = await Promise.all([
      window.api.getSettings(),
      window.api.getAppVersion(),
      window.api.getLaunchView()
    ])
    // Un publieur retrouve la dernière vue utilisée (ou le studio avec --studio).
    const view = settings.role === 'publisher' ? (launchView ?? settings.lastView) : 'library'
    set({ settings, appVersion, view })
    await Promise.all([get().refresh(), get().refreshLocal()])
  },

  async refresh(force = false) {
    set({ refreshing: true })
    try {
      const catalog = await window.api.getCatalog(force)
      set({ catalog })
      if (force && catalog.error) get().pushToast({ kind: 'error', title: 'Actualisation impossible', message: catalog.error })
    } finally {
      set({ loading: false, refreshing: false })
    }
  },

  async refreshLocal() {
    const [installed, curseForge, shortcut, settings] = await Promise.all([
      window.api.getInstalled(),
      window.api.getCurseForgeStatus(),
      window.api.getShortcutStatus(),
      window.api.getSettings()
    ])
    const catalog = get().catalog
    set({ installed, curseForge, shortcut, settings })
    if (settings.role !== 'publisher' && get().view === 'studio') set({ view: 'library' })
    // Le dépôt a pu être changé ailleurs (script, autre session) : on recharge ses modpacks.
    if (catalog && !sameRepo(catalog.repo, settings.repo)) await get().refresh(true)
  },

  async install(version) {
    if (get().busyId) return
    set({
      busyId: version.id,
      progress: { id: version.id, version: version.version, phase: 'preparing', done: 0, total: 0, bytesPerSecond: 0 }
    })
    try {
      const result = await window.api.install(version)
      if (result.ok) {
        get().pushToast({
          kind: 'success',
          title: result.updated ? `${version.name} est à jour` : `${version.name} est installé`,
          message: result.curseForgeLaunched
            ? 'CurseForge est ouvert : lance le profil depuis l’onglet Minecraft.'
            : 'Le profil est disponible dans CurseForge, onglet Minecraft.',
          action: result.curseForgeLaunched ? undefined : { label: 'Ouvrir CurseForge', run: () => void get().launchCurseForge() }
        })
      } else if (result.cancelled) {
        get().pushToast({ kind: 'info', title: 'Installation annulée' })
      } else {
        get().pushToast({ kind: 'error', title: `Échec de l’installation de ${version.name}`, message: result.error })
      }
    } finally {
      set({ busyId: null, progress: null })
      await get().refreshLocal()
    }
  },

  cancelInstall() {
    const id = get().busyId
    if (id) void window.api.cancelInstall(id)
  },

  async launchCurseForge() {
    const ok = await window.api.launchCurseForge()
    if (!ok) {
      get().pushToast({
        kind: 'error',
        title: 'CurseForge introuvable',
        message: 'Installe l’application CurseForge pour jouer aux modpacks.'
      })
    }
  },

  select(selectedId) {
    set({ selectedId })
  },

  setSettingsOpen(settingsOpen) {
    set({ settingsOpen })
  },

  async updateSettings(patch) {
    const settings = await window.api.updateSettings(patch)
    set({ settings })
    await get().refreshLocal()
  },

  async pickInstancesDir() {
    const settings = await window.api.pickInstancesDir()
    if (settings) {
      set({ settings })
      await get().refreshLocal()
    }
  },

  async createShortcut(location) {
    const result = await window.api.createShortcut(location)
    if (result.ok) {
      const onDesktop = result.path.toLowerCase() === get().shortcut?.desktopPath.toLowerCase()
      get().pushToast({
        kind: 'success',
        title: 'Raccourci créé',
        message: onDesktop ? 'Modpack Downloader est maintenant sur ton bureau.' : result.path
      })
      set({ settings: await window.api.getSettings(), shortcut: await window.api.getShortcutStatus() })
    } else if (!result.cancelled) {
      get().pushToast({ kind: 'error', title: 'Raccourci non créé', message: result.error })
    }
  },

  async applyRoleResult(result) {
    if (!result.ok) return
    const previous = get().settings
    set({ settings: result.settings })
    if (previous?.role !== result.settings.role) {
      // Changement de rôle : on referme les paramètres et on montre tout de suite la vue du nouveau rôle.
      set({ settingsOpen: false })
      get().setView(result.settings.role === 'publisher' ? 'studio' : 'library')
    }
    if (result.warning) get().pushToast({ kind: 'info', title: 'Dépôt privé', message: result.warning })
    if (!previous || !sameRepo(previous.repo, result.settings.repo)) await get().refresh(true)
  },

  setView(view) {
    const next = view === 'studio' && get().settings?.role !== 'publisher' ? 'library' : view
    if (next === get().view) return
    set({ view: next, selectedId: null })
    void window.api.updateSettings({ lastView: next })
  },

  openStudio() {
    set({ settingsOpen: false })
    get().setView('studio')
  },

  async installAppUpdate() {
    const update = get().catalog?.appUpdate
    if (!update) return
    set({ appUpdateProgress: { done: 0, total: update.installerSize } })
    const result = await window.api.installAppUpdate(update)
    if (!result.ok) {
      set({ appUpdateProgress: null })
      get().pushToast({ kind: 'error', title: 'Mise à jour impossible', message: result.error })
    }
  },

  pushToast(toast) {
    const id = ++toastSeq
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }))
    setTimeout(() => get().dismissToast(id), toast.kind === 'error' ? 10_000 : 7_000)
  },

  dismissToast(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  }
}))
