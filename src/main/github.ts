import { app } from 'electron'
import { join } from 'node:path'
import { APP_TAG_PREFIX, GITHUB_OWNER, GITHUB_REPO } from '../shared/config'
import {
  compareVersions,
  findManifestAsset,
  groupModpacks,
  isModpackManifest,
  modpackVersionFromRelease,
  type GhAsset,
  type GhRelease
} from '../shared/releases'
import type { AppUpdateInfo, Catalog, ModpackManifest, ModpackVersion } from '../shared/types'
import { readJson, writeJsonAtomic } from './fsutil'

// En développement, MPD_GITHUB_API permet de pointer vers un faux serveur de releases.
const API_BASE =
  (!app.isPackaged && process.env.MPD_GITHUB_API) || `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`
const MAX_PAGES = 5
const MEMORY_TTL_MS = 60_000

interface HttpCacheEntry {
  etag: string
  data: unknown
}

type HttpCache = Record<string, HttpCacheEntry>
type ManifestCache = Record<string, ModpackManifest>

let httpCache: HttpCache | null = null
let manifestCache: ManifestCache | null = null
let lastCatalog: { at: number; catalog: Catalog } | null = null

const cacheFile = (name: string) => join(app.getPath('userData'), 'cache', name)

function userAgent(): string {
  return `ModpackDownloader/${app.getVersion()}`
}

async function loadCaches(): Promise<void> {
  httpCache ??= (await readJson<HttpCache>(cacheFile('github-http.json'))) ?? {}
  manifestCache ??= (await readJson<ManifestCache>(cacheFile('manifests.json'))) ?? {}
}

class GitHubError extends Error {}

/** GET sur l'API GitHub avec cache ETag : une réponse 304 ne consomme pas le quota. */
async function apiGet<T>(url: string): Promise<T> {
  const cached = httpCache![url]
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': userAgent()
  }
  if (cached) headers['If-None-Match'] = cached.etag

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) })
  if (res.status === 304 && cached) return cached.data as T
  if (res.status === 403 || res.status === 429) {
    const reset = Number(res.headers.get('x-ratelimit-reset'))
    const when = reset
      ? new Date(reset * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : 'plus tard'
    throw new GitHubError(`Limite de requêtes GitHub atteinte. Réessaie après ${when}.`)
  }
  if (res.status === 404) {
    throw new GitHubError(`Dépôt ${GITHUB_OWNER}/${GITHUB_REPO} introuvable (il doit être public).`)
  }
  if (!res.ok) throw new GitHubError(`GitHub a répondu ${res.status} ${res.statusText}.`)

  const data = (await res.json()) as T
  const etag = res.headers.get('etag')
  if (etag) httpCache![url] = { etag, data }
  return data
}

async function fetchReleases(): Promise<GhRelease[]> {
  const releases: GhRelease[] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const batch = await apiGet<GhRelease[]>(`${API_BASE}/releases?per_page=100&page=${page}`)
    releases.push(...batch)
    if (batch.length < 100) break
  }
  return releases
}

/** Releases disponibles dans le cache disque (utilisé hors ligne). */
function cachedReleases(): GhRelease[] {
  const releases: GhRelease[] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const entry = httpCache![`${API_BASE}/releases?per_page=100&page=${page}`]
    if (!entry) break
    const batch = entry.data as GhRelease[]
    releases.push(...batch)
    if (batch.length < 100) break
  }
  return releases
}

async function fetchManifest(asset: GhAsset, offline: boolean): Promise<ModpackManifest | null> {
  const key = `${asset.id}:${asset.updated_at}`
  if (manifestCache![key]) return manifestCache![key]
  if (offline) return null
  try {
    // L'URL de téléchargement public ne consomme pas le quota de l'API.
    const res = await fetch(asset.browser_download_url, {
      headers: { 'User-Agent': userAgent() },
      signal: AbortSignal.timeout(20_000)
    })
    if (!res.ok) return null
    const json: unknown = await res.json()
    if (!isModpackManifest(json)) return null
    manifestCache![key] = json
    return json
  } catch {
    return null
  }
}

async function buildModpackVersions(releases: GhRelease[], offline: boolean): Promise<ModpackVersion[]> {
  const versions = await Promise.all(
    releases.map(async (release) => {
      if (release.draft || release.tag_name.startsWith(APP_TAG_PREFIX)) return null
      const asset = findManifestAsset(release)
      const manifest = asset ? await fetchManifest(asset, offline) : null
      if (asset && !manifest) return null
      return modpackVersionFromRelease(release, manifest)
    })
  )
  return versions.filter((v): v is ModpackVersion => v !== null)
}

function findAppUpdate(releases: GhRelease[]): AppUpdateInfo | null {
  let best: { release: GhRelease; version: string } | null = null
  for (const release of releases) {
    if (release.draft || release.prerelease || !release.tag_name.startsWith(APP_TAG_PREFIX)) continue
    const version = release.tag_name.slice(APP_TAG_PREFIX.length)
    if (!best || compareVersions(version, best.version) > 0) best = { release, version }
  }
  if (!best || compareVersions(best.version, app.getVersion()) <= 0) return null
  const installer = best.release.assets.find((a) => a.name.toLowerCase().endsWith('.exe'))
  return {
    version: best.version,
    notes: best.release.body ?? '',
    releaseUrl: best.release.html_url,
    installerUrl: installer?.browser_download_url ?? null,
    installerSize: installer?.size ?? 0
  }
}

export async function getCatalog(force = false): Promise<Catalog> {
  if (!force && lastCatalog && Date.now() - lastCatalog.at < MEMORY_TTL_MS) return lastCatalog.catalog
  await loadCaches()

  let releases: GhRelease[]
  let error: string | null = null
  let offline = false
  try {
    releases = await fetchReleases()
  } catch (err) {
    offline = true
    error =
      err instanceof GitHubError
        ? err.message
        : 'Impossible de joindre GitHub. Vérifie ta connexion internet.'
    releases = cachedReleases()
  }

  const catalog: Catalog = {
    modpacks: groupModpacks(await buildModpackVersions(releases, offline)),
    appUpdate: findAppUpdate(releases),
    fetchedAt: offline ? null : new Date().toISOString(),
    error
  }

  if (!offline) {
    lastCatalog = { at: Date.now(), catalog }
    await Promise.all([
      writeJsonAtomic(cacheFile('github-http.json'), httpCache),
      writeJsonAtomic(cacheFile('manifests.json'), manifestCache)
    ]).catch(() => {})
  }
  return catalog
}
