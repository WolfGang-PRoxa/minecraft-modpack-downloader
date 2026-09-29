import { useEffect, useState, type ReactNode } from 'react'
import { ExternalLink, FolderCog, FolderOpen, KeyRound, Monitor, TerminalSquare } from 'lucide-react'
import type { GitHubStatus } from '../../../shared/studio'
import type { ShortcutLocation, ShortcutStatus } from '../../../shared/types'
import { Button } from '../components/Button'
import { Modal, TextInput } from './Modal'
import { errorMessage, openLink, openPath, useStudio } from './store'

const TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new'

const TOKEN_SOURCES: Record<NonNullable<GitHubStatus['tokenSource']>, string> = {
  env: 'la variable d’environnement GITHUB_TOKEN',
  studio: 'le jeton enregistré dans le studio',
  dotenv: 'le fichier .env',
  gh: 'ta session GitHub CLI (gh)'
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-white/[0.06] py-6 first:border-t-0 first:pt-0">
      <h3 className="mb-3 text-xs font-semibold tracking-widest text-ink-400 uppercase">{title}</h3>
      {children}
    </section>
  )
}

export function GitHubSummary({ github }: { github: GitHubStatus }) {
  switch (github.state) {
    case 'ok':
      return (
        <p className="text-sm text-ink-200">
          Connecté{github.login ? <> en tant que <strong className="text-ink-100">{github.login}</strong></> : ''} via{' '}
          {TOKEN_SOURCES[github.tokenSource!]}.
          {github.canPush === false && <span className="text-red-300"> Ce compte ne peut pas publier sur le dépôt.</span>}
        </p>
      )
    case 'no-token':
      return <p className="text-sm text-amber-glow">Pas de connexion à GitHub : colle un jeton ci-dessous, ou lance « gh auth login ».</p>
    case 'error':
      return <p className="text-sm text-red-300 select-text">{github.error}</p>
    default:
      return <p className="text-sm text-ink-400">Pas encore vérifié.</p>
  }
}

export function SettingsDialog() {
  const overview = useStudio((s) => s.overview)
  const close = useStudio((s) => s.closeDialog)
  const refresh = useStudio((s) => s.refresh)
  const pushToast = useStudio((s) => s.pushToast)
  const [token, setToken] = useState('')
  const [saving, setSaving] = useState(false)
  const [shortcut, setShortcut] = useState<ShortcutStatus | null>(null)

  useEffect(() => {
    void window.studio.getShortcutStatus().then(setShortcut)
  }, [])
  if (!overview) return null
  const { settings, github } = overview

  async function saveToken(value: string | null) {
    setSaving(true)
    try {
      const status = await window.studio.setToken(value)
      setToken('')
      if (status.state === 'ok') pushToast({ kind: 'success', title: value ? 'Jeton enregistré' : 'Jeton oublié' })
      else if (value) pushToast({ kind: 'error', title: 'Jeton refusé', message: status.error ?? undefined })
    } catch (err) {
      pushToast({ kind: 'error', title: 'Enregistrement impossible', message: errorMessage(err) })
    } finally {
      setSaving(false)
      void refresh()
    }
  }

  async function createShortcut(location: ShortcutLocation) {
    try {
      const result = await window.studio.createShortcut(location)
      if (result.ok) {
        pushToast({ kind: 'success', title: 'Raccourci créé', message: result.path })
        setShortcut(await window.studio.getShortcutStatus())
      } else if (!result.cancelled) {
        pushToast({ kind: 'error', title: 'Raccourci non créé', message: result.error })
      }
    } catch (err) {
      pushToast({ kind: 'error', title: 'Raccourci non créé', message: errorMessage(err) })
    }
  }

  async function changeFolder() {
    if (await window.studio.pickWorkspaceDir()) void refresh({ remote: true })
  }

  return (
    <Modal title="Paramètres" onClose={close}>
      <Section title="Dossier des modpacks">
        <div className="rounded-xl bg-ink-950/60 px-4 py-3 font-mono text-[13px] break-all text-ink-100 ring-1 ring-inset ring-white/[0.06] select-text">
          {settings.workspaceDir ?? 'Aucun'}
        </div>
        <p className="mt-2 text-xs text-ink-400">Un sous-dossier par modpack, avec les zips de ses mises à jour.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" icon={FolderCog} onClick={() => void changeFolder()}>
            Changer…
          </Button>
          {settings.workspaceDir && overview.workspaceExists && (
            <Button size="sm" variant="ghost" icon={FolderOpen} onClick={() => openPath(settings.workspaceDir!)}>
              Ouvrir
            </Button>
          )}
        </div>
      </Section>

      <Section title="GitHub">
        <GitHubSummary github={github} />
        <p className="mt-1 text-xs text-ink-400">
          Dépôt :{' '}
          <button type="button" className="font-semibold text-grass-300 hover:text-grass-400" onClick={() => openLink(github.repoUrl)}>
            {github.repo}
          </button>
          {github.repoPrivate && ' · privé : les joueurs ne voient aucun modpack tant qu’il n’est pas public.'}
        </p>

        <form
          className="mt-5 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (token.trim()) void saveToken(token)
          }}
        >
          <TextInput
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={settings.hasStoredToken ? 'Remplacer le jeton enregistré…' : 'Coller un jeton GitHub (github_pat_…)'}
            autoComplete="off"
          />
          <Button type="submit" icon={KeyRound} disabled={!token.trim() || saving}>
            Enregistrer
          </Button>
        </form>
        <p className="mt-2 text-xs leading-relaxed text-ink-400">
          Jeton « fine-grained » limité à ce dépôt, avec l’accès <strong className="text-ink-300">Contents : Read and write</strong>{' '}
          (
          <button type="button" className="font-semibold text-grass-300 hover:text-grass-400" onClick={() => openLink(TOKEN_URL)}>
            en créer un <ExternalLink size={11} className="inline" />
          </button>
          ). Il est chiffré par Windows. Sans jeton, le studio utilise ta session GitHub CLI.
        </p>
        {settings.hasStoredToken && (
          <Button size="sm" variant="ghost" className="mt-3" disabled={saving} onClick={() => void saveToken(null)}>
            Oublier le jeton enregistré
          </Button>
        )}
      </Section>

      <Section title="Raccourci">
        <p className="text-sm text-ink-200">
          {shortcut?.onDesktop
            ? 'Modpack Studio a un raccourci sur ton bureau.'
            : 'Ouvre le studio d’un double-clic, sans passer par le terminal.'}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" icon={Monitor} onClick={() => void createShortcut('desktop')}>
            {shortcut?.onDesktop ? 'Recréer sur le bureau' : 'Ajouter au bureau'}
          </Button>
          <Button size="sm" variant="ghost" icon={FolderOpen} onClick={() => void createShortcut('choose')}>
            Autre emplacement…
          </Button>
        </div>
        <p className="mt-2 text-xs text-ink-400">
          Depuis le code source, le raccourci ouvre la dernière version compilée : relance « npm run build » après une
          mise à jour du code.
        </p>
      </Section>

      <Section title="En ligne de commande">
        <div className="flex gap-3 text-sm text-ink-300">
          <TerminalSquare size={18} className="mt-0.5 shrink-0 text-ink-400" />
          <p>
            Les mêmes opérations existent dans le terminal, sur le même dossier :{' '}
            <code className="rounded bg-ink-750 px-1.5 py-0.5 text-[12px] select-text">npm run modpacks:ranger</code> et{' '}
            <code className="rounded bg-ink-750 px-1.5 py-0.5 text-[12px] select-text">npm run modpacks:publier</code>.
          </p>
        </div>
      </Section>
    </Modal>
  )
}
