import { useEffect, useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ChevronRight, ExternalLink, File, FileImage, FileText, Folder, Package, Search } from 'lucide-react'
import type { ZipContents, ZipEntryPreview, ZipFileEntry, ZipMod } from '../../../shared/studio'
import { IconButton } from '../components/Button'
import { formatBytes } from '../lib/format'
import { Modal, Spinner } from './Modal'
import { errorMessage, openLink, useStudio } from './store'

/** Résultats affichés au plus pour une recherche dans les fichiers. */
const MAX_MATCHES = 400

interface FolderNode {
  name: string
  path: string
  folders: FolderNode[]
  files: ZipFileEntry[]
  size: number
  count: number
}

const byName = (a: string, b: string) => a.localeCompare(b, 'fr', { sensitivity: 'base', numeric: true })

function buildTree(files: ZipFileEntry[]): FolderNode {
  type Draft = Omit<FolderNode, 'folders'> & { folders: Map<string, Draft> }
  const draft = (name: string, path: string): Draft => ({ name, path, folders: new Map(), files: [], size: 0, count: 0 })
  const root = draft('', '')
  for (const file of files) {
    const parts = file.path.split('/')
    let node = root
    node.size += file.size
    node.count++
    for (const part of parts.slice(0, -1)) {
      let child = node.folders.get(part)
      if (!child) node.folders.set(part, (child = draft(part, node.path ? `${node.path}/${part}` : part)))
      child.size += file.size
      child.count++
      node = child
    }
    node.files.push(file)
  }
  const finish = (node: Draft): FolderNode => ({
    ...node,
    folders: [...node.folders.values()].sort((a, b) => byName(a.name, b.name)).map(finish),
    files: node.files.sort((a, b) => byName(a.path, b.path))
  })
  return finish(root)
}

function findFolder(root: FolderNode, path: string): FolderNode | null {
  let node: FolderNode | undefined = root
  for (const part of path ? path.split('/') : []) node = node?.folders.find((f) => f.name === part)
  return node ?? null
}

const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1)

function fileIcon(path: string): LucideIcon {
  if (/\.(png|jpe?g|gif|webp)$/i.test(path)) return FileImage
  if (/\.(jar|zip|class|dat|nbt|mca|ogg|bin)$/i.test(path)) return File
  return FileText
}

function ListRow({
  icon: Icon,
  label,
  detail,
  active = false,
  mono = false,
  onClick
}: {
  icon: LucideIcon
  label: string
  detail: string
  active?: boolean
  mono?: boolean
  onClick(): void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition ${
        active ? 'bg-grass-400/10 text-grass-300' : 'text-ink-200 hover:bg-white/[0.05]'
      }`}
    >
      <Icon size={15} className={`shrink-0 ${active ? '' : 'text-ink-500'}`} />
      <span className={`min-w-0 flex-1 truncate ${mono ? 'font-mono text-xs' : ''}`}>{label}</span>
      <span className="shrink-0 text-xs text-ink-400 tabular-nums">{detail}</span>
    </button>
  )
}

const panel = 'rounded-2xl bg-ink-950/40 ring-1 ring-inset ring-white/[0.06]'

function ModsList({ mods, query }: { mods: ZipMod[]; query: string }) {
  const sorted = useMemo(() => [...mods].sort((a, b) => byName(a.name ?? a.fileName, b.name ?? b.fileName)), [mods])
  // Sans aucun nom connu, minecraftinstance.json ne liste pas ses mods : on ne peut rien dire de leur origine.
  const named = mods.some((mod) => mod.name)
  const q = query.trim().toLowerCase()
  const shown = q ? sorted.filter((mod) => [mod.name, mod.author, mod.fileName].some((v) => v?.toLowerCase().includes(q))) : sorted

  return (
    <div className={`h-full overflow-y-auto ${panel}`}>
      {shown.map((mod) => (
        <div key={mod.fileName} className="flex items-center gap-4 border-b border-white/[0.04] px-4 py-2.5 last:border-0">
          <Package size={16} className="shrink-0 text-ink-500" />
          <div className="min-w-0 flex-1">
            <p className={`truncate text-sm font-medium select-text ${mod.disabled ? 'text-ink-400 line-through' : 'text-ink-100'}`}>
              {mod.name ?? mod.fileName}
            </p>
            <p className="truncate text-xs text-ink-400 select-text">
              {mod.name
                ? [mod.author, mod.fileName].filter(Boolean).join(' · ')
                : named
                  ? 'Ajouté à la main : CurseForge ne le connaît pas'
                  : ''}
            </p>
          </div>
          {mod.disabled && (
            <span className="shrink-0 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-ink-300 uppercase">
              Désactivé
            </span>
          )}
          <span className="w-16 shrink-0 text-right text-xs text-ink-400 tabular-nums">{formatBytes(mod.size)}</span>
          {mod.url ? (
            <IconButton icon={ExternalLink} size={15} label="Page CurseForge du mod" onClick={() => openLink(mod.url!)} />
          ) : (
            <span className="size-9 shrink-0" />
          )}
        </div>
      ))}
      {shown.length === 0 && (
        <p className="px-4 py-6 text-sm text-ink-400">{q ? 'Aucun mod ne correspond.' : 'Aucun mod dans le dossier mods.'}</p>
      )}
    </div>
  )
}

function Preview({ folder, fileName, file }: { folder: string; fileName: string; file: ZipFileEntry | null }) {
  const [preview, setPreview] = useState<{ path: string; result: ZipEntryPreview } | null>(null)
  const [error, setError] = useState<{ path: string; message: string } | null>(null)

  useEffect(() => {
    if (!file) return
    let alive = true
    window.studio.previewZipEntry(folder, fileName, file.path).then(
      (result) => alive && setPreview({ path: file.path, result }),
      (err: unknown) => alive && setError({ path: file.path, message: errorMessage(err) })
    )
    return () => {
      alive = false
    }
  }, [folder, fileName, file])

  if (!file) {
    return (
      <div className={`flex min-w-0 flex-1 items-center justify-center px-8 text-center text-sm text-ink-400 ${panel}`}>
        Choisis un fichier pour afficher son contenu.
      </div>
    )
  }
  const result = preview?.path === file.path ? preview.result : null
  const failure = error?.path === file.path ? error.message : null
  const message = (text: string) => <p className="flex h-full items-center justify-center px-8 text-center text-sm text-ink-400">{text}</p>

  let body
  if (failure) body = message(failure)
  else if (!result) body = <div className="flex h-full items-center justify-center"><Spinner className="text-grass-300" /></div>
  else if (result.kind === 'text') {
    body = (
      <>
        <pre className="min-h-0 flex-1 overflow-auto px-4 py-3 font-mono text-xs leading-relaxed whitespace-pre text-ink-200 select-text">
          {result.text || '(fichier vide)'}
        </pre>
        {result.truncated && (
          <p className="border-t border-white/[0.06] px-4 py-2 text-xs text-ink-400">Fichier long : seul son début est affiché.</p>
        )}
      </>
    )
  } else if (result.kind === 'image') {
    body = (
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-[repeating-conic-gradient(#ffffff0a_0%_25%,transparent_0%_50%)] bg-size-[20px_20px] p-6">
        {/* Les textures font souvent 16 px : agrandies sans flou. */}
        <img src={result.dataUrl} alt={baseName(file.path)} className="max-h-full max-w-full min-w-32 [image-rendering:pixelated]" />
      </div>
    )
  } else if (result.kind === 'too-large') body = message('Image trop lourde pour l’aperçu (plus de 4 Mo).')
  else body = message(/\.jar$/i.test(file.path) ? 'Archive Java (mod) : pas d’aperçu.' : 'Fichier binaire : pas d’aperçu.')

  return (
    <div className={`flex min-w-0 flex-1 flex-col overflow-hidden ${panel}`}>
      <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-2.5">
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink-200 select-text" title={file.path}>
          {file.path}
        </span>
        <span className="shrink-0 text-xs text-ink-400 tabular-nums">{formatBytes(file.size)}</span>
      </div>
      {body}
    </div>
  )
}

function FilesBrowser({ folder, fileName, contents, query }: { folder: string; fileName: string; contents: ZipContents; query: string }) {
  const tree = useMemo(() => buildTree(contents.files), [contents])
  const [cwd, setCwd] = useState('')
  const [selected, setSelected] = useState<ZipFileEntry | null>(null)
  const node = findFolder(tree, cwd) ?? tree
  const q = query.trim().toLowerCase()
  const matches = useMemo(() => (q ? contents.files.filter((f) => f.path.toLowerCase().includes(q)) : null), [contents, q])
  const crumbs = cwd ? cwd.split('/') : []

  return (
    <div className="flex h-full gap-4">
      <div className={`flex w-[42%] shrink-0 flex-col overflow-hidden ${panel}`}>
        <div className="flex min-h-11 flex-wrap items-center gap-1 border-b border-white/[0.06] px-3 py-2 text-xs">
          {matches ? (
            <span className="px-1 text-ink-300">
              {matches.length} fichier{matches.length > 1 ? 's' : ''} trouvé{matches.length > 1 ? 's' : ''}
              {matches.length > MAX_MATCHES && ` (les ${MAX_MATCHES} premiers affichés)`}
            </span>
          ) : (
            [contents.root || 'Instance', ...crumbs].map((part, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight size={12} className="text-ink-500" />}
                <button
                  type="button"
                  onClick={() => setCwd(crumbs.slice(0, i).join('/'))}
                  className={`rounded-md px-1.5 py-0.5 transition hover:bg-white/[0.07] ${i === crumbs.length ? 'font-semibold text-ink-100' : 'text-ink-400'}`}
                >
                  {part}
                </button>
              </span>
            ))
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          {matches
            ? matches.slice(0, MAX_MATCHES).map((file) => (
                <ListRow
                  key={file.path}
                  icon={fileIcon(file.path)}
                  label={file.path}
                  detail={formatBytes(file.size)}
                  mono
                  active={selected?.path === file.path}
                  onClick={() => setSelected(file)}
                />
              ))
            : [
                ...node.folders.map((child) => (
                  <ListRow
                    key={`d:${child.path}`}
                    icon={Folder}
                    label={child.name}
                    detail={`${child.count} fichier${child.count > 1 ? 's' : ''} · ${formatBytes(child.size)}`}
                    onClick={() => setCwd(child.path)}
                  />
                )),
                ...node.files.map((file) => (
                  <ListRow
                    key={`f:${file.path}`}
                    icon={fileIcon(file.path)}
                    label={baseName(file.path)}
                    detail={formatBytes(file.size)}
                    active={selected?.path === file.path}
                    onClick={() => setSelected(file)}
                  />
                ))
              ]}
          {matches?.length === 0 && <p className="px-4 py-6 text-sm text-ink-400">Aucun fichier ne correspond.</p>}
        </div>
      </div>
      <Preview folder={folder} fileName={fileName} file={selected} />
    </div>
  )
}

type Tab = 'mods' | 'files'

/** Contenu d'un zip de modpack, sans passer par l'Explorateur : ses mods, ses fichiers et leur aperçu. */
export function ContentsDialog({ folder, fileName, label }: { folder: string; fileName: string; label: string }) {
  const close = useStudio((s) => s.closeDialog)
  const packName = useStudio((s) => s.overview?.packs.find((p) => p.folder === folder)?.name ?? folder)
  const [contents, setContents] = useState<ZipContents | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('mods')
  const [query, setQuery] = useState('')

  useEffect(() => {
    let alive = true
    window.studio.getZipContents(folder, fileName).then(
      (result) => {
        if (!alive) return
        setContents(result)
        if (result.mods.length === 0) setTab('files')
      },
      (err: unknown) => alive && setError(errorMessage(err))
    )
    return () => {
      alive = false
    }
  }, [folder, fileName])

  const total = contents?.files.reduce((sum, file) => sum + file.size, 0) ?? 0
  const tabs: Array<{ id: Tab; label: string; count: number }> = contents
    ? [
        { id: 'mods', label: 'Mods', count: contents.mods.length },
        { id: 'files', label: 'Fichiers', count: contents.files.length }
      ]
    : []

  return (
    <Modal
      title={`Contenu de ${label}`}
      subtitle={
        <span className="select-text">
          {packName} · {fileName}
          {contents && ` · ${formatBytes(total)} une fois installé`}
        </span>
      }
      onClose={close}
      width="max-w-6xl"
    >
      <div className="flex h-[min(68vh,46rem)] flex-col">
        {error ? (
          <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-inset ring-red-400/25 select-text">{error}</p>
        ) : !contents ? (
          <div className="flex flex-1 items-center justify-center gap-3 text-ink-300">
            <Spinner className="text-grass-300" /> Lecture du zip…
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <nav className="flex rounded-xl bg-white/[0.04] p-1 ring-1 ring-inset ring-white/[0.06]" aria-label="Contenu">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    aria-current={tab === t.id ? 'page' : undefined}
                    onClick={() => {
                      setTab(t.id)
                      setQuery('')
                    }}
                    className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition ${
                      tab === t.id ? 'bg-white/10 text-ink-100' : 'text-ink-400 hover:text-ink-200'
                    }`}
                  >
                    {t.label}
                    <span className="text-xs font-bold text-ink-400 tabular-nums">{t.count}</span>
                  </button>
                ))}
              </nav>
              <div className="flex-1" />
              <label className="flex h-10 w-80 items-center gap-2 rounded-xl bg-ink-950/60 px-3 ring-1 ring-inset ring-white/10 focus-within:ring-grass-400/60">
                <Search size={15} className="shrink-0 text-ink-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={tab === 'mods' ? 'Chercher un mod' : 'Chercher un fichier'}
                  className="min-w-0 flex-1 bg-transparent text-sm text-ink-100 outline-none placeholder:text-ink-500"
                />
              </label>
            </div>
            <div className="mt-4 min-h-0 flex-1">
              {tab === 'mods' ? (
                <ModsList mods={contents.mods} query={query} />
              ) : (
                <FilesBrowser folder={folder} fileName={fileName} contents={contents} query={query} />
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
