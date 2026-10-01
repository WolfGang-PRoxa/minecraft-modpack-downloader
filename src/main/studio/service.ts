import { join } from 'node:path'
import { APP_REPO } from '../../shared/config'
import { modpackTag, parseModpackTag } from '../../shared/releases'
import { repoSlug, repoUrl, sameRepo } from '../../shared/repo'
import type {
  GitHubStatus,
  OrphanPack,
  PackView,
  PublishProgress,
  PublishResult,
  RangerOrders,
  RangerPlan,
  StudioOverview,
  StudioSettings
} from '../../shared/studio'
import type { RepoRef, Settings } from '../../shared/types'
import type { Credential } from '../auth'
import { AnalysisCache, describeError, StudioError } from './analyze'
import { zipInstance } from './archive'
import { GitHubClient } from './githubApi'
import { applyPlan, computePlan, fetchRemoteState, highestRemoteNumber, type InternalPlan, type RemoteState } from './sync'
import {
  applyRanger,
  createPack,
  importFiles,
  loadPackMeta,
  nextVersionNumber,
  planRanger,
  scanWorkspace,
  setCover,
  versionFileName,
  writePackFile,
  type LocalPack,
  type LocalWorkspace
} from './workspace'

export interface StudioServiceOptions {
  /** Dossier des modpacks (réglage propre au studio). */
  getWorkspaceDir(): string | null
  defaultWorkspaceDir: string
  /** Rôle et dépôt, relus à chaque fois dans les réglages de l'application. */
  getAppSettings(): Promise<Pick<Settings, 'role' | 'repo'>>
  getCredential(): Promise<Credential | null>
  /** URL de l'image d'un modpack pour la fenêtre du studio. */
  coverUrl?(pack: LocalPack): string | null
  onAnalyzing?(fileName: string | null): void
  /** Ce qui interdit de démarrer une opération d'écriture (« la mise à jour de l'application »…), sinon null. */
  blockedBy?(): string | null
}

function uncheckedGitHub(repo: RepoRef): GitHubStatus {
  return {
    state: 'unchecked',
    repo: repoSlug(repo),
    repoUrl: repoUrl(repo),
    login: null,
    tokenSource: null,
    repoPrivate: null,
    canPush: null,
    error: null,
    checkedAt: null
  }
}

/**
 * Point d'entrée commun du studio (fenêtre) et des scripts `modpacks:*` :
 * lecture du dossier, rangement, comparaison avec GitHub et publication.
 */
export class StudioService {
  private cache: { dir: string; cache: AnalysisCache } | null = null
  private scanning: Promise<LocalWorkspace | null> | null = null
  private remote: RemoteState | null = null
  /** Dépôt auquel correspond `remote` : un changement de dépôt invalide tout. */
  private remoteRepo: RepoRef = APP_REPO
  private github: GitHubStatus = uncheckedGitHub(APP_REPO)
  private busy: string | null = null

  constructor(private readonly options: StudioServiceOptions) {}

  private get workspaceDir(): string | null {
    return this.options.getWorkspaceDir()
  }

  /** Empêche deux opérations d'écriture en même temps (rangement pendant une publication…). */
  private async exclusive<T>(label: string, run: () => Promise<T>): Promise<T> {
    const other = this.busy ?? this.options.blockedBy?.() ?? null
    if (other) throw new StudioError(`Patiente : ${other} est en cours.`)
    this.busy = label
    try {
      return await run()
    } finally {
      this.busy = null
    }
  }

  /** Opération d'écriture en cours (« la publication »…), sinon null. */
  get currentTask(): string | null {
    return this.busy
  }

  private requireWorkspace(): string {
    const dir = this.workspaceDir
    if (!dir) throw new StudioError('Choisis d’abord le dossier de tes modpacks.')
    return dir
  }

  /** Les lectures du dossier s'enchaînent : deux analyses du même zip ne tournent jamais en parallèle. */
  async scan(): Promise<LocalWorkspace | null> {
    while (this.scanning) await this.scanning.catch(() => null)
    this.scanning = this.doScan()
    try {
      return await this.scanning
    } finally {
      this.scanning = null
    }
  }

  private async doScan(): Promise<LocalWorkspace | null> {
    const dir = this.workspaceDir
    if (!dir) return null
    if (this.cache?.dir !== dir) this.cache = { dir, cache: await AnalysisCache.load(dir) }
    return scanWorkspace(dir, this.cache.cache, this.options.onAnalyzing)
  }

  private async client(): Promise<{ client: GitHubClient; credential: Credential } | null> {
    const { repo } = await this.options.getAppSettings()
    const credential = await this.options.getCredential()
    return credential ? { client: new GitHubClient(credential.token, repo), credential } : null
  }

  /** Relit les releases GitHub (et vérifie la connexion). */
  async refreshRemote(): Promise<GitHubStatus> {
    const { repo } = await this.options.getAppSettings()
    const status = uncheckedGitHub(repo)
    status.checkedAt = new Date().toISOString()
    if (!sameRepo(repo, this.remoteRepo)) this.remote = null
    this.remoteRepo = repo
    const auth = await this.client()
    if (!auth) {
      this.remote = null
      this.github = { ...status, state: 'no-token' }
      return this.github
    }
    status.tokenSource = auth.credential.source
    try {
      const [repo, login] = await Promise.all([auth.client.getRepo(), auth.client.getLogin()])
      status.login = login
      status.repoPrivate = repo.private
      status.canPush = repo.permissions?.push ?? null
      this.remote = await fetchRemoteState(auth.client, this.remote)
      this.github = { ...status, state: 'ok' }
    } catch (err) {
      this.remote = null
      this.github = { ...status, state: 'error', error: describeError(err) }
    }
    return this.github
  }

  get githubStatus(): GitHubStatus {
    return this.github
  }

  async overview(options: { refreshRemote?: boolean } = {}): Promise<StudioOverview> {
    const app = await this.options.getAppSettings()
    // Dépôt changé dans l'application depuis la dernière lecture : on relit GitHub.
    const repoChanged = !sameRepo(app.repo, this.remoteRepo) && this.github.state !== 'unchecked'
    if ((options.refreshRemote || repoChanged) && !this.busy) await this.refreshRemote()
    const settings: StudioSettings = {
      workspaceDir: this.workspaceDir,
      defaultWorkspaceDir: this.options.defaultWorkspaceDir,
      role: app.role,
      repo: app.repo
    }
    const workspace = await this.scan()
    const plan = workspace && this.remote ? computePlan(workspace, this.remote, this.remoteRepo.owner) : null
    return {
      settings,
      workspaceExists: workspace?.exists ?? false,
      packs: workspace ? workspace.packs.map((pack) => this.packView(pack, plan)) : [],
      strayZips: workspace?.strayZips ?? [],
      orphanPacks: workspace && plan ? this.orphanPacks(workspace, plan) : [],
      toRange: workspace ? planRanger(workspace).total : 0,
      github: this.github,
      plan: plan?.view ?? null
    }
  }

  private packView(pack: LocalPack, plan: InternalPlan | null): PackView {
    const blocked = pack.errors.length > 0
    const remoteOnly = plan
      ? plan.steps
          .filter((s) => s.kind === 'delete' && s.action.packId === pack.meta.id)
          .map((s) => {
            const release = s.kind === 'delete' ? (s.releases.find((r) => !r.draft) ?? s.releases[0]) : null
            return {
              tag: s.action.tag,
              version: parseModpackTag(s.action.tag)?.version ?? s.action.tag,
              url: release?.html_url ?? repoUrl(this.remoteRepo),
              draft: Boolean(release?.draft)
            }
          })
      : []
    return {
      folder: pack.folder,
      dir: pack.dir,
      id: pack.meta.id,
      name: pack.meta.name,
      description: pack.meta.description,
      coverUrl: this.options.coverUrl?.(pack) ?? null,
      versions: [...pack.versions].reverse().map((v) => {
        const status = plan?.statuses.get(modpackTag(pack.meta.id, String(v.number)))
        return {
          number: v.number,
          fileName: v.fileName,
          path: v.path,
          size: v.size,
          modifiedAt: new Date(v.mtimeMs).toISOString(),
          analysis: v.analysis,
          error: v.error,
          notes: pack.meta.notes[String(v.number)] ?? '',
          remote: blocked || v.error ? 'blocked' : (status?.status ?? 'unknown'),
          changes: status?.changes ?? []
        }
      }),
      pending: pack.pending.map((f) => ({
        fileName: f.fileName,
        size: f.size,
        modifiedAt: new Date(f.mtimeMs).toISOString(),
        error: f.error,
        warnings: f.analysis?.warnings ?? []
      })),
      remoteOnly,
      errors: pack.errors,
      nextVersion: nextVersionNumber(pack)
    }
  }

  private orphanPacks(workspace: LocalWorkspace, plan: InternalPlan): OrphanPack[] {
    const localIds = new Set(workspace.packs.map((p) => p.meta.id))
    const byId = new Map<string, OrphanPack>()
    for (const step of plan.steps) {
      if (step.kind !== 'delete' || localIds.has(step.action.packId)) continue
      const id = step.action.packId || step.action.tag
      const entry = byId.get(id) ?? { id, name: step.action.label.replace(/ v[^ ]+$/, ''), versions: [] }
      entry.versions.push(parseModpackTag(step.action.tag)?.version ?? step.action.tag)
      byId.set(id, entry)
    }
    return [...byId.values()]
  }

  // ---------------------------------------------------------------------------------------------
  // Rangement

  async rangerPlan(orders?: RangerOrders): Promise<RangerPlan> {
    const workspace = await this.scan()
    return workspace ? planRanger(workspace, orders) : { packs: [], total: 0 }
  }

  applyRanger(orders?: RangerOrders): Promise<number> {
    return this.exclusive('le rangement', async () => {
      this.requireWorkspace()
      const workspace = (await this.scan())!
      return applyRanger(workspace, planRanger(workspace, orders))
    })
  }

  // ---------------------------------------------------------------------------------------------
  // Publication

  /** Calcule le plan à partir d'un état de GitHub tout frais. */
  async freshPlan(): Promise<InternalPlan> {
    this.requireWorkspace()
    if ((await this.options.getAppSettings()).role !== 'publisher') {
      throw new StudioError('Passe en mode publieur (Paramètres → Utilisation) pour publier.')
    }
    const github = await this.refreshRemote()
    if (github.state !== 'ok' || !this.remote) {
      throw new StudioError(github.state === 'no-token' ? 'Pas de connexion GitHub : connecte-toi dans les paramètres.' : github.error!)
    }
    const workspace = await this.scan()
    if (!workspace?.exists) throw new StudioError('Le dossier des modpacks est introuvable.')
    return computePlan(workspace, this.remote, this.remoteRepo.owner)
  }

  publish(
    fingerprint: string,
    onProgress: (progress: PublishProgress) => void,
    signal: AbortSignal
  ): Promise<PublishResult> {
    return this.exclusive('la publication', async () => {
      let plan: InternalPlan
      try {
        plan = await this.freshPlan()
      } catch (err) {
        return { ok: false, cancelled: false, error: describeError(err), done: 0 }
      }
      if (plan.view.fingerprint !== fingerprint) {
        return {
          ok: false,
          cancelled: false,
          error: 'Le dossier ou GitHub a changé depuis l’aperçu : vérifie la nouvelle liste puis relance.',
          done: 0
        }
      }
      const auth = await this.client()
      if (!auth) return { ok: false, cancelled: false, error: 'Pas de connexion GitHub.', done: 0 }

      // L'identifiant et le dernier numéro sont figés dans pack.json dès la première publication.
      const packs = new Set(plan.steps.flatMap((s) => (s.kind === 'delete' ? [] : [s.desired.pack])))
      for (const pack of packs) {
        const highest = Math.max(pack.meta.lastVersion, pack.maxNumber, highestRemoteNumber(this.remote!, pack.meta.id))
        if (!pack.hasPackFile || highest > pack.meta.lastVersion) {
          await writePackFile(pack.dir, { ...pack.meta, lastVersion: highest }).catch(() => {})
        }
      }

      try {
        return await applyPlan(auth.client, plan, { onProgress, signal })
      } finally {
        await this.refreshRemote()
      }
    })
  }

  // ---------------------------------------------------------------------------------------------
  // Modpacks

  createPack(name: string): Promise<string> {
    return this.exclusive('la création du modpack', async () => {
      this.requireWorkspace()
      return createPack((await this.scan())!, name)
    })
  }

  async updatePackInfo(folder: string, info: { name: string; description: string }): Promise<void> {
    const name = info.name.trim().replace(/\s+/g, ' ')
    if (!name) throw new StudioError('Le nom ne peut pas être vide.')
    const { dir, meta } = await loadPackMeta(this.requireWorkspace(), folder)
    await writePackFile(dir, { ...meta, name, description: info.description.trim() })
  }

  async setNotes(folder: string, version: number, notes: string): Promise<void> {
    const { dir, meta } = await loadPackMeta(this.requireWorkspace(), folder)
    await writePackFile(dir, { ...meta, notes: { ...meta.notes, [String(version)]: notes.replace(/\r\n/g, '\n').trim() } })
  }

  async setCover(folder: string, source: string | null): Promise<void> {
    const { dir } = await loadPackMeta(this.requireWorkspace(), folder)
    await setCover(dir, source)
  }

  async importFiles(folder: string, paths: string[]) {
    return this.exclusive('la copie des fichiers', async () => {
      const { dir } = await loadPackMeta(this.requireWorkspace(), folder)
      return importFiles(dir, paths)
    })
  }

  /** Zippe une instance CurseForge directement comme prochaine version du modpack. */
  zipInstance(
    folder: string,
    instancePath: string,
    includeSaves: boolean,
    onProgress: (done: number, total: number) => void,
    signal: AbortSignal
  ): Promise<string> {
    return this.exclusive('la création du zip', async () => {
      this.requireWorkspace()
      const workspace = (await this.scan())!
      const pack = workspace.packs.find((p) => p.folder === folder)
      if (!pack) throw new StudioError(`Le modpack ${folder} est introuvable.`)
      if (pack.packFileError) throw new StudioError(pack.packFileError)
      const number = nextVersionNumber(pack)
      const fileName = versionFileName(pack.folder, number)
      await zipInstance(instancePath, join(pack.dir, fileName), { includeSaves, onProgress, signal })
      await writePackFile(pack.dir, { ...pack.meta, lastVersion: number })
      return fileName
    })
  }
}
