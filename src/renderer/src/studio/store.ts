import { create } from 'zustand'
import type { ActionResult, StudioOverview } from '../../../shared/studio'
import type { ToastItem } from '../components/Toasts'

export type Dialog =
  | { kind: 'settings' }
  | { kind: 'new-pack' }
  | { kind: 'pack-info'; folder: string }
  | { kind: 'notes'; folder: string; version: number }
  | { kind: 'import'; folder: string }
  | { kind: 'ranger' }
  | { kind: 'publish' }

interface StudioState {
  overview: StudioOverview | null
  /** Nombre de lectures du dossier en cours. */
  pending: number
  checkingGitHub: boolean
  analyzing: string | null
  dialog: Dialog | null
  toasts: ToastItem[]

  init(): Promise<void>
  refresh(options?: { remote?: boolean }): Promise<void>
  openDialog(dialog: Dialog): void
  closeDialog(): void
  /** Affiche l'erreur d'une action du studio ; renvoie true si elle a réussi. */
  run(result: Promise<ActionResult>, success?: string): Promise<boolean>
  pushToast(toast: Omit<ToastItem, 'id'>): void
  dismissToast(id: number): void
}

/** Retire l'enrobage ajouté par Electron aux erreurs levées dans le processus principal. */
export function errorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  return message.replace(/^Error invoking remote method '[^']+': (?:\w*Error: )?/, '')
}

let toastSeq = 0
let initialized = false

export const useStudio = create<StudioState>((set, get) => ({
  overview: null,
  pending: 0,
  checkingGitHub: false,
  analyzing: null,
  dialog: null,
  toasts: [],

  async init() {
    if (initialized) return
    initialized = true
    window.studio.onChanged(() => void get().refresh())
    window.studio.onAnalyzing((analyzing) => set({ analyzing }))
    await get().refresh()
    await get().refresh({ remote: true })
  },

  async refresh({ remote = false } = {}) {
    set((s) => ({ pending: s.pending + 1, checkingGitHub: s.checkingGitHub || remote }))
    try {
      // Chaque réponse est appliquée à son arrivée : une vérification de GitHub plus lente
      // qu'une simple relecture du dossier apporte quand même le dernier état de GitHub.
      set({ overview: await window.studio.getOverview({ refreshRemote: remote }) })
    } catch (err) {
      get().pushToast({ kind: 'error', title: 'Lecture du dossier impossible', message: errorMessage(err) })
    } finally {
      set((s) => ({ pending: s.pending - 1, checkingGitHub: remote ? false : s.checkingGitHub }))
    }
  },

  openDialog(dialog) {
    set({ dialog })
  },

  closeDialog() {
    set({ dialog: null })
  },

  async run(result, success) {
    let outcome: ActionResult
    try {
      outcome = await result
    } catch (err) {
      outcome = { ok: false, error: errorMessage(err) }
    }
    if (!outcome.ok) {
      get().pushToast({ kind: 'error', title: 'Opération impossible', message: outcome.error })
      return false
    }
    if (success) get().pushToast({ kind: 'success', title: success })
    void get().refresh()
    return true
  },

  pushToast(toast) {
    const id = ++toastSeq
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }))
    setTimeout(() => get().dismissToast(id), toast.kind === 'error' ? 12_000 : 6_000)
  },

  dismissToast(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  }
}))

export const openLink = (url: string) => void window.studio.openExternal(url)
export const openPath = (path: string) =>
  void window.studio.openPath(path).catch((err: unknown) =>
    useStudio.getState().pushToast({ kind: 'error', title: 'Ouverture impossible', message: errorMessage(err) })
  )
