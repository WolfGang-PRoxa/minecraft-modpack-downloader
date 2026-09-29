import { execFile } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { join } from 'node:path'
import { GITHUB_OWNER, GITHUB_REPO } from '../../shared/config'
import type { GhAsset, GhRelease } from '../../shared/releases'
import { StudioError } from './analyze'

export const GITHUB_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`
const USER_AGENT = 'ModpackStudio'

export type TokenSource = 'env' | 'studio' | 'dotenv' | 'gh'

export class GitHubError extends StudioError {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}

export class CancelledError extends StudioError {
  constructor() {
    super('Publication arrêtée.')
  }
}

function ghCliToken(): Promise<string | null> {
  return new Promise((resolvePromise) => {
    execFile('gh', ['auth', 'token'], { windowsHide: true, timeout: 10_000 }, (err, stdout) =>
      resolvePromise(err ? null : stdout.trim() || null)
    )
  })
}

/**
 * Jeton utilisé pour publier, par ordre de priorité : variable GITHUB_TOKEN, jeton enregistré
 * dans le studio, fichier .env (scripts), puis la session de GitHub CLI (`gh auth login`).
 */
export async function resolveToken(options: {
  stored?: string | null
  dotenvDir?: string
}): Promise<{ token: string; source: TokenSource } | null> {
  const env = process.env.GITHUB_TOKEN?.trim()
  if (env) return { token: env, source: 'env' }
  if (options.stored) return { token: options.stored, source: 'studio' }
  if (options.dotenvDir) {
    const text = await readFile(join(options.dotenvDir, '.env'), 'utf8').catch(() => '')
    const match = /^GITHUB_TOKEN=(.+)$/m.exec(text)
    if (match?.[1].trim()) return { token: match[1].trim(), source: 'dotenv' }
  }
  const gh = await ghCliToken()
  return gh ? { token: gh, source: 'gh' } : null
}

async function toGitHubError(res: Response, method: string, url: string): Promise<GitHubError> {
  let detail = ''
  try {
    const json = (await res.json()) as { message?: string; errors?: Array<{ message?: string; code?: string }> }
    detail = [json.message, ...(json.errors ?? []).map((e) => e.message ?? e.code)].filter(Boolean).join(' · ')
  } catch {
    // corps vide ou non JSON
  }
  const where = `${method} ${new URL(url).pathname}`
  switch (res.status) {
    case 401:
      return new GitHubError('GitHub refuse le jeton (expiré ou révoqué). Mets-en un nouveau dans les paramètres.', 401)
    case 403:
      if (res.headers.get('x-ratelimit-remaining') === '0') {
        return new GitHubError('Limite de requêtes GitHub atteinte : réessaie dans quelques minutes.', 403)
      }
      return new GitHubError(
        `GitHub refuse l’opération (${where}) : le jeton doit avoir l’accès « Contents : Read and write » sur le dépôt.`,
        403
      )
    case 404:
      return new GitHubError(
        `Introuvable sur GitHub (${where}) : vérifie que le jeton a accès au dépôt ${GITHUB_OWNER}/${GITHUB_REPO}.`,
        404
      )
    default:
      return new GitHubError(`GitHub a répondu ${res.status} (${where})${detail ? ` : ${detail}` : ''}.`, res.status)
  }
}

export type UploadSource = { file: string } | { data: Buffer }

export interface UploadOptions {
  onProgress?: (done: number, total: number) => void
  signal?: AbortSignal
}

export class GitHubClient {
  constructor(
    private readonly token: string,
    readonly apiBase: string = GITHUB_API
  ) {}

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': USER_AGENT,
      Authorization: `Bearer ${this.token}`,
      ...extra
    }
  }

  private async send(method: string, url: string, init: RequestInit = {}): Promise<Response> {
    let res: Response
    try {
      res = await fetch(url, { method, signal: AbortSignal.timeout(60_000), ...init })
    } catch {
      throw new StudioError('Impossible de joindre GitHub. Vérifie ta connexion internet.')
    }
    if (!res.ok && res.status !== 302) throw await toGitHubError(res, method, url)
    return res
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = path.startsWith('http') ? path : `${this.apiBase}${path}`
    const res = await this.send(method, url, {
      headers: this.headers(body ? { 'Content-Type': 'application/json' } : {}),
      body: body ? JSON.stringify(body) : undefined
    })
    const text = res.status === 204 ? '' : await res.text()
    return (text ? JSON.parse(text) : undefined) as T
  }

  getRepo(): Promise<{ private: boolean; full_name: string; permissions?: { push?: boolean } }> {
    return this.request('GET', '')
  }

  async getLogin(): Promise<string | null> {
    const userUrl = this.apiBase.replace(/\/repos\/[^/]+\/[^/]+\/?$/, '/user')
    try {
      return (await this.request<{ login: string }>('GET', userUrl)).login
    } catch {
      return null
    }
  }

  async listReleases(): Promise<GhRelease[]> {
    const releases: GhRelease[] = []
    for (let page = 1; page <= 30; page++) {
      const batch = await this.request<GhRelease[]>('GET', `/releases?per_page=100&page=${page}`)
      releases.push(...batch)
      if (batch.length < 100) break
    }
    return releases
  }

  getRelease(id: number): Promise<GhRelease> {
    return this.request('GET', `/releases/${id}`)
  }

  createRelease(data: Record<string, unknown>): Promise<GhRelease> {
    return this.request('POST', '/releases', data)
  }

  updateRelease(id: number, data: Record<string, unknown>): Promise<GhRelease> {
    return this.request('PATCH', `/releases/${id}`, data)
  }

  async deleteRelease(id: number): Promise<void> {
    await this.ignoreMissing(this.request('DELETE', `/releases/${id}`))
  }

  /** Supprimer une release laisse son tag : on le retire aussi. */
  async deleteTag(tag: string): Promise<void> {
    await this.ignoreMissing(this.request('DELETE', `/git/refs/tags/${encodeURIComponent(tag)}`))
  }

  async deleteAsset(id: number): Promise<void> {
    await this.ignoreMissing(this.request('DELETE', `/releases/assets/${id}`))
  }

  renameAsset(id: number, name: string): Promise<GhAsset> {
    return this.request('PATCH', `/releases/assets/${id}`, { name })
  }

  private async ignoreMissing(promise: Promise<unknown>): Promise<void> {
    try {
      await promise
    } catch (err) {
      if (!(err instanceof GitHubError && (err.status === 404 || err.status === 422))) throw err
    }
  }

  /** Contenu d'un fichier de release (via l'API : fonctionne aussi pour un dépôt privé). */
  async downloadAssetText(asset: GhAsset): Promise<string> {
    const url = `${this.apiBase}/releases/assets/${asset.id}`
    const res = await this.send('GET', url, {
      headers: this.headers({ Accept: 'application/octet-stream' }),
      redirect: 'manual'
    })
    const location = res.headers.get('location')
    if (res.status !== 302 || !location) return res.text()
    // Le fichier est servi par un autre domaine, qui refuse l'en-tête Authorization.
    const file = await this.send('GET', location, { headers: { 'User-Agent': USER_AGENT } })
    return file.text()
  }

  async uploadAsset(
    release: GhRelease,
    source: UploadSource,
    name: string,
    contentType: string,
    options: UploadOptions = {}
  ): Promise<GhAsset> {
    const { onProgress, signal } = options
    if (signal?.aborted) throw new CancelledError()
    const url = new URL(release.upload_url.replace(/\{.*\}$/, ''))
    url.searchParams.set('name', name)
    const size = 'file' in source ? (await stat(source.file)).size : source.data.length

    return new Promise<GhAsset>((resolvePromise, reject) => {
      const send = url.protocol === 'http:' ? httpRequest : httpsRequest
      const req = send(
        url,
        { method: 'POST', headers: this.headers({ 'Content-Type': contentType, 'Content-Length': String(size) }) },
        (res) => {
          const chunks: Buffer[] = []
          res.on('data', (chunk: Buffer) => chunks.push(chunk))
          res.on('error', reject)
          res.on('end', () => {
            signal?.removeEventListener('abort', onAbort)
            const text = Buffer.concat(chunks).toString('utf8')
            const status = res.statusCode ?? 0
            if (status >= 200 && status < 300) {
              try {
                resolvePromise(JSON.parse(text) as GhAsset)
              } catch {
                reject(new StudioError(`Réponse inattendue de GitHub après l’envoi de ${name}.`))
              }
              return
            }
            let detail = ''
            try {
              detail = (JSON.parse(text) as { message?: string }).message ?? ''
            } catch {
              detail = text.slice(0, 200)
            }
            reject(new GitHubError(`GitHub a refusé ${name} (${status})${detail ? ` : ${detail}` : ''}.`, status))
          })
        }
      )
      const onAbort = () => req.destroy(new CancelledError())
      signal?.addEventListener('abort', onAbort, { once: true })
      req.setTimeout(120_000, () => req.destroy(new StudioError('GitHub ne répond plus.')))
      req.on('error', (err) => {
        signal?.removeEventListener('abort', onAbort)
        reject(err instanceof StudioError ? err : new StudioError(`Envoi de ${name} interrompu : ${err.message}`))
      })

      if ('data' in source) {
        req.end(source.data)
        onProgress?.(size, size)
        return
      }
      let sent = 0
      const stream = createReadStream(source.file, { highWaterMark: 1024 * 1024 })
      stream.on('data', (chunk) => {
        sent += chunk.length
        onProgress?.(sent, size)
      })
      stream.on('error', (err) => req.destroy(err))
      stream.pipe(req)
    })
  }
}
