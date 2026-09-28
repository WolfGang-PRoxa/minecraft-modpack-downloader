import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Blocks, Cpu, HardDrive, Package } from 'lucide-react'
import type { ModpackVersion } from '../../../shared/types'
import { formatBytes, formatLoader } from '../lib/format'
import type { PackStatus } from '../lib/status'

export function MetaChip({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-ink-200 ring-1 ring-inset ring-white/[0.06]">
      <Icon size={13} strokeWidth={2.25} className="text-ink-300" />
      {children}
    </span>
  )
}

export function VersionMeta({ version, withSize = true }: { version: ModpackVersion; withSize?: boolean }) {
  const loader = formatLoader(version.modLoader)
  return (
    <div className="flex flex-wrap gap-2">
      {version.minecraftVersion && <MetaChip icon={Blocks}>Minecraft {version.minecraftVersion}</MetaChip>}
      {loader && <MetaChip icon={Cpu}>{loader}</MetaChip>}
      {version.modCount !== null && <MetaChip icon={Package}>{version.modCount} mods</MetaChip>}
      {withSize && version.archiveSize > 0 && <MetaChip icon={HardDrive}>{formatBytes(version.archiveSize)}</MetaChip>}
    </div>
  )
}

export function StatusBadge({ status }: { status: PackStatus }) {
  if (status.kind === 'available') return null
  const styles = {
    installed: 'bg-grass-400/15 text-grass-300 ring-grass-400/30',
    update: 'bg-amber-glow/15 text-amber-glow ring-amber-glow/35',
    'other-version': 'bg-sky-400/15 text-sky-300 ring-sky-400/30'
  }[status.kind]
  const label = {
    installed: 'Installé',
    update: 'Mise à jour disponible',
    'other-version': `v${status.installed.version} installée`
  }[status.kind]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset backdrop-blur-md ${styles}`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  )
}
