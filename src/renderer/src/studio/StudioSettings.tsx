import { FolderCog, FolderOpen, TerminalSquare } from 'lucide-react'
import { Button } from '../components/Button'
import { useStore } from '../store'
import { openPath, refreshStudioIfOpen } from './store'

/** Réglage « Dossier des modpacks » (publieurs), dans les paramètres de l'application. */
export function WorkspaceFolderSetting() {
  const workspaceDir = useStore((s) => s.settings?.workspaceDir ?? null)
  const refreshLocal = useStore((s) => s.refreshLocal)

  async function change() {
    if (!(await window.studio.pickWorkspaceDir())) return
    await refreshLocal()
    refreshStudioIfOpen({ remote: true })
  }

  return (
    <>
      <div className="rounded-xl bg-ink-950/60 px-4 py-3 font-mono text-[13px] break-all text-ink-100 ring-1 ring-inset ring-white/[0.06] select-text">
        {workspaceDir ?? 'Pas encore choisi : le Studio te le demandera.'}
      </div>
      <p className="mt-2 text-xs text-ink-400">Un sous-dossier par modpack, avec les zips de ses mises à jour.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" icon={FolderCog} onClick={() => void change()}>
          Changer…
        </Button>
        {workspaceDir && (
          <Button size="sm" variant="ghost" icon={FolderOpen} onClick={() => openPath(workspaceDir)}>
            Ouvrir
          </Button>
        )}
      </div>
    </>
  )
}

export function CommandLineHint() {
  return (
    <div className="flex gap-3 text-sm text-ink-300">
      <TerminalSquare size={18} className="mt-0.5 shrink-0 text-ink-400" />
      <p>
        Les mêmes opérations que le Studio existent dans le terminal, sur le même dossier :{' '}
        <code className="rounded bg-ink-750 px-1.5 py-0.5 text-[12px] select-text">npm run modpacks:ranger</code> et{' '}
        <code className="rounded bg-ink-750 px-1.5 py-0.5 text-[12px] select-text">npm run modpacks:publier</code>.
      </p>
    </div>
  )
}
