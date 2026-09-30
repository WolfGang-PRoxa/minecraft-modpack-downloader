import { CloudUpload, Library, Maximize2, Minimize2, Minus, RefreshCw, Settings, X } from 'lucide-react'
import type { AppView } from '../../../shared/types'
import { useStudio } from '../studio/store'
import { useStore } from '../store'
import { IconButton } from './Button'
import { Logo } from './Logo'

function CurseForgeChip() {
  const curseForge = useStore((s) => s.curseForge)
  const launch = useStore((s) => s.launchCurseForge)
  const openSettings = useStore((s) => s.setSettingsOpen)
  if (!curseForge) return null

  const ok = curseForge.installed
  return (
    <button
      type="button"
      onClick={() => (ok ? void launch() : openSettings(true))}
      title={ok ? 'Ouvrir CurseForge' : 'CurseForge est introuvable'}
      className="no-drag flex items-center gap-2 rounded-full bg-white/[0.05] py-1.5 pr-3.5 pl-3 text-xs font-medium text-ink-200 ring-1 ring-inset ring-white/[0.07] transition hover:bg-white/[0.09]"
    >
      <span className="relative flex size-2">
        {ok && <span className="absolute inset-0 animate-ping rounded-full bg-curseforge/60" />}
        <span className={`relative size-2 rounded-full ${ok ? 'bg-curseforge' : 'bg-ink-500'}`} />
      </span>
      {ok ? 'CurseForge' : 'CurseForge introuvable'}
    </button>
  )
}

const VIEWS: Array<{ view: AppView; label: string; icon: typeof Library }> = [
  { view: 'library', label: 'Bibliothèque', icon: Library },
  { view: 'studio', label: 'Studio', icon: CloudUpload }
]

/** Bibliothèque et Studio : deux vues de la même fenêtre, le Studio n'existant que pour un publieur. */
function ViewTabs() {
  const publisher = useStore((s) => s.settings?.role === 'publisher')
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  if (!publisher) return null
  return (
    <nav className="no-drag ml-4 flex rounded-xl bg-white/[0.04] p-1 ring-1 ring-inset ring-white/[0.06]" aria-label="Vues">
      {VIEWS.map((tab) => (
        <button
          key={tab.view}
          type="button"
          aria-current={view === tab.view ? 'page' : undefined}
          onClick={() => setView(tab.view)}
          className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition ${
            view === tab.view ? 'bg-white/10 text-ink-100' : 'text-ink-400 hover:text-ink-200'
          }`}
        >
          <tab.icon size={15} /> {tab.label}
        </button>
      ))}
    </nav>
  )
}

export function TitleBar() {
  const libraryRefreshing = useStore((s) => s.refreshing)
  const refresh = useStore((s) => s.refresh)
  const refreshLocal = useStore((s) => s.refreshLocal)
  const fullscreen = useStore((s) => s.fullscreen)
  const openSettings = useStore((s) => s.setSettingsOpen)
  const studio = useStore((s) => s.view === 'studio' && s.settings?.role === 'publisher')
  const studioRefreshing = useStudio((s) => s.pending > 0)
  const refreshStudio = useStudio((s) => s.refresh)
  const refreshing = studio ? studioRefreshing : libraryRefreshing

  return (
    <header className="drag-region relative z-30 flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.05] bg-ink-900/70 pr-2 pl-5 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <Logo size={26} />
        <div className="leading-tight">
          <div className="font-display text-[15px] font-semibold tracking-tight text-ink-100">Modpack Downloader</div>
        </div>
      </div>
      <ViewTabs />

      <div className="flex-1" />

      <div className="no-drag flex items-center gap-1">
        <CurseForgeChip />
        <div className="mx-2 h-5 w-px bg-white/10" />
        <IconButton
          icon={RefreshCw}
          label={studio ? 'Relire le dossier et GitHub' : 'Actualiser'}
          onClick={() => void (studio ? refreshStudio({ remote: true }) : Promise.all([refresh(true), refreshLocal()]))}
          disabled={refreshing}
          className={refreshing ? '[&_svg]:animate-spin' : ''}
        />
        <IconButton icon={Settings} label="Paramètres" onClick={() => openSettings(true)} />
        <div className="mx-2 h-5 w-px bg-white/10" />
        <IconButton icon={Minus} label="Réduire" onClick={() => window.api.minimizeWindow()} />
        <IconButton
          icon={fullscreen ? Minimize2 : Maximize2}
          label={fullscreen ? 'Quitter le plein écran (F11)' : 'Plein écran (F11)'}
          size={16}
          onClick={() => window.api.toggleFullscreen()}
        />
        <IconButton
          icon={X}
          label="Fermer"
          onClick={() => window.api.closeWindow()}
          className="hover:bg-red-500/85! hover:text-white!"
        />
      </div>
    </header>
  )
}
