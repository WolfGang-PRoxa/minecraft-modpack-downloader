import { Maximize2, Minimize2, Minus, RefreshCw, Settings, X } from 'lucide-react'
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

export function TitleBar() {
  const refreshing = useStore((s) => s.refreshing)
  const refresh = useStore((s) => s.refresh)
  const refreshLocal = useStore((s) => s.refreshLocal)
  const fullscreen = useStore((s) => s.fullscreen)
  const openSettings = useStore((s) => s.setSettingsOpen)

  return (
    <header className="drag-region relative z-30 flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.05] bg-ink-900/70 pr-2 pl-5 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <Logo size={26} />
        <div className="leading-tight">
          <div className="font-display text-[15px] font-semibold tracking-tight text-ink-100">Modpack Downloader</div>
        </div>
      </div>

      <div className="flex-1" />

      <div className="no-drag flex items-center gap-1">
        <CurseForgeChip />
        <div className="mx-2 h-5 w-px bg-white/10" />
        <IconButton
          icon={RefreshCw}
          label="Actualiser"
          onClick={() => void Promise.all([refresh(true), refreshLocal()])}
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
