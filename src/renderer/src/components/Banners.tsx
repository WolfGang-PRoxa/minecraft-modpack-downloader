import type { ReactNode } from 'react'
import { CircleArrowUp, ExternalLink, TriangleAlert, WifiOff } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { CURSEFORGE_DOWNLOAD_URL } from '../../../shared/config'
import { formatBytes } from '../lib/format'
import { useStore } from '../store'
import { Button } from './Button'

function Banner({ icon: Icon, tone, children, action }: { icon: LucideIcon; tone: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className={`animate-rise mx-8 mt-6 flex items-center gap-4 rounded-2xl px-5 py-4 ring-1 ring-inset ${tone}`}>
      <Icon size={22} className="shrink-0" />
      <div className="min-w-0 flex-1 text-sm text-ink-100">{children}</div>
      {action}
    </div>
  )
}

export function AppUpdateBanner() {
  const update = useStore((s) => s.catalog?.appUpdate)
  const progress = useStore((s) => s.appUpdateProgress)
  const install = useStore((s) => s.installAppUpdate)
  if (!update) return null

  const percent = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : null
  return (
    <Banner
      icon={CircleArrowUp}
      tone="bg-sky-400/10 text-sky-300 ring-sky-400/25"
      action={
        <Button size="sm" variant="primary" disabled={progress !== null} onClick={() => void install()}>
          {progress ? `Téléchargement${percent !== null ? ` ${percent} %` : '…'}` : 'Mettre à jour'}
        </Button>
      }
    >
      <strong className="font-semibold">Nouvelle version de l’application : v{update.version}</strong>
      <span className="text-ink-300">
        {' '}
        · {update.installerSize ? `${formatBytes(update.installerSize)} · ` : ''}l’application redémarrera toute seule.
      </span>
    </Banner>
  )
}

export function OfflineBanner() {
  const error = useStore((s) => s.catalog?.error)
  const hasModpacks = useStore((s) => (s.catalog?.modpacks.length ?? 0) > 0)
  const refresh = useStore((s) => s.refresh)
  if (!error || !hasModpacks) return null
  return (
    <Banner
      icon={WifiOff}
      tone="bg-amber-glow/10 text-amber-glow ring-amber-glow/25"
      action={
        <Button size="sm" onClick={() => void refresh(true)}>
          Réessayer
        </Button>
      }
    >
      <strong className="font-semibold">Liste non actualisée.</strong> <span className="text-ink-300">{error}</span>
    </Banner>
  )
}

export function CurseForgeMissingBanner() {
  const curseForge = useStore((s) => s.curseForge)
  if (!curseForge || curseForge.installed) return null
  return (
    <Banner
      icon={TriangleAlert}
      tone="bg-curseforge/10 text-curseforge ring-curseforge/30"
      action={
        <Button size="sm" variant="primary" icon={ExternalLink} onClick={() => void window.api.openExternal(CURSEFORGE_DOWNLOAD_URL)}>
          Télécharger CurseForge
        </Button>
      }
    >
      <strong className="font-semibold">CurseForge n’est pas installé.</strong>{' '}
      <span className="text-ink-300">Il est nécessaire pour jouer aux modpacks. Installe-le puis relance cette application.</span>
    </Banner>
  )
}
