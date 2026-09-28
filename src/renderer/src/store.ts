import { create } from 'zustand'
import type {
  AppUpdateProgress,
  Catalog,
  CurseForgeStatus,
  InstalledModpack,
  InstallProgress,
  ModpackVersion,
  Settings
} from '../../shared/types'

export interface Toast {
  id: number
  kind: 'success' | 'error' | 'info'
  title: string
  message?: string
  action?: { label: string; run: () => void }
}

interface State {
  catalog: Catalog | null
  loading: boolean
  refreshing: boolean
  installed: InstalledModpack[]
  curseForge: CurseForgeStatus | null
  settings: Settings | null
  appVersion: string
  fullscreen: boolean
  progress: InstallProgress | null
  busyId: string | null
  selectedId: string | null
  settingsOpen: boolean
  toasts: Toast[]
  appUpdateProgress: AppUpdateProgress | null

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
  settings: null,
  appVersion: '',
  fullscreen: true,
  progress: null,
  busyId: null,
  selectedId: null,
  settingsOpen: false,
  toasts: [],
  appUpdateProgress: null,

  async init() {
    if (initialized) return
    initialized = true
    window.api.onInstallProgress((progress) => set({ progress }))
    window.api.onAppUpdateProgress((appUpdateProgress) => set({ appUpdateProgress }))
    window.api.onFullscreenChange((fullscreen) => set({ fullscreen }))
    const [settings, appVersion] = await Promise.all([window.api.getSettings(), window.api.getAppVersion()])
    set({ settings, appVersion })
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
    const [installed, curseForge] = await Promise.all([window.api.getInstalled(), window.api.getCurseForgeStatus()])
    set({ installed, curseForge })
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
