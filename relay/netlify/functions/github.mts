import { loadConfig, RelayError } from '../../src/config.mts'
import { compare, compareUrl, getIssue, issueOfBranch, LABEL_PROPOSED, setFixLabel, type Issue } from '../../src/github.mts'
import { emptyProposalMail, issueMail, proposalMail, sendMail } from '../../src/mail.mts'
import { signLink, verifyGitHubSignature } from '../../src/sign.mts'
import { splitCommitMessage } from '../../src/text.mts'

// Webhook du dépôt GitHub. Deux événements comptent :
//  - une issue est ouverte : le propriétaire reçoit le mail « corriger / ajouter du contexte » ;
//  - une session de correction pousse sa branche : le propriétaire reçoit le mail « valider / invalider », avec
//    le résumé écrit par la session dans son message de commit.

interface IssuesEvent {
  action: string
  issue: Issue
}

interface PushEvent {
  ref: string
  after: string
  deleted: boolean
  head_commit: { message: string } | null
  repository: { default_branch: string }
}

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } })

async function onIssueOpened(req: Request, event: IssuesEvent): Promise<Response> {
  const config = loadConfig(req, ['linkSecret', 'resendKey', 'ownerEmail'])
  const link = (a: 'corriger' | 'contexte') => `${config.baseUrl}/action?t=${signLink({ a, i: event.issue.number }, config.linkSecret)}`
  const id = await sendMail(config, issueMail(event.issue, { fix: link('corriger'), context: link('contexte') }))
  return json(200, { mail: 'issue', issue: event.issue.number, id })
}

async function onPush(req: Request, event: PushEvent): Promise<Response> {
  const branch = event.ref.replace(/^refs\/heads\//, '')
  const number = issueOfBranch(branch)
  if (number === null || event.deleted || !event.head_commit) return json(202, { ignored: 'push' })

  const config = loadConfig(req, ['repo', 'githubToken', 'linkSecret', 'resendKey', 'ownerEmail'])
  const issue = await getIssue(config, number)
  const base = event.repository.default_branch
  const { title, summary } = splitCommitMessage(event.head_commit.message)
  const { files } = await compare(config, base, event.after)
  // Le lien ne vaut que pour ce commit : une proposition plus récente périme les boutons de ce mail.
  const link = (a: 'valider' | 'invalider') => `${config.baseUrl}/action?t=${signLink({ a, i: number, b: branch, h: event.after }, config.linkSecret)}`

  if (files.length === 0) {
    // Rien à fusionner : la session explique pourquoi, le propriétaire peut préciser sa demande.
    await setFixLabel(config, issue, null).catch(() => {})
    const id = await sendMail(config, emptyProposalMail(issue, { title, summary }, { reject: link('invalider') }))
    return json(200, { mail: 'sans-correction', issue: number, id })
  }

  // L'étiquette n'est qu'un repère : son échec ne doit pas priver le propriétaire du mail.
  await setFixLabel(config, issue, LABEL_PROPOSED).catch(() => {})
  const proposal = { title: title || `fix: issue #${number}`, summary, files, diffUrl: compareUrl(config, base, branch) }
  const id = await sendMail(config, proposalMail(issue, proposal, { approve: link('valider'), reject: link('invalider') }))
  return json(200, { mail: 'proposition', issue: number, id })
}

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json(405, { error: 'POST attendu' })
  const body = await req.text()
  try {
    const config = loadConfig(req, ['repo', 'webhookSecret'])
    if (!verifyGitHubSignature(body, req.headers.get('x-hub-signature-256'), config.webhookSecret)) {
      return json(401, { error: 'signature invalide' })
    }
    const event = req.headers.get('x-github-event')
    const payload = JSON.parse(body) as { repository?: { full_name?: string } }
    if (event === 'ping') return json(200, { ok: true })
    if (payload.repository?.full_name?.toLowerCase() !== config.repo.toLowerCase()) return json(202, { ignored: 'autre dépôt' })

    if (event === 'issues') {
      const issues = payload as unknown as IssuesEvent
      if (issues.action === 'opened' || issues.action === 'reopened') return await onIssueOpened(req, issues)
    }
    if (event === 'push') return await onPush(req, payload as unknown as PushEvent)
    return json(202, { ignored: event })
  } catch (err) {
    // Le détail reste dans les livraisons du webhook, visibles du seul propriétaire du dépôt.
    const status = err instanceof RelayError ? err.status : 500
    return json(status, { error: err instanceof Error ? err.message : String(err) })
  }
}

export const config = { path: '/github' }
