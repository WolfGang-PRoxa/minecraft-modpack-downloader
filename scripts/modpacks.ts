// Les deux opérations du Modpack Studio, en ligne de commande :
//
//   npm run modpacks:ranger     numérote les zips déposés dans le dossier de chaque modpack
//   npm run modpacks:publier    met les releases GitHub en accord avec le dossier (création,
//                               mise à jour, suppression des versions dont le zip a disparu)
//
// Options : --dir <dossier>   dossier des modpacks (par défaut : celui choisi dans le studio)
//           --repo <o/nom>    dépôt GitHub (par défaut : celui choisi dans l'application)
//           --yes / -y        ne pas demander de confirmation
//           --dry-run         (publier) afficher ce qui changerait, sans rien faire
import { confirm } from '@inquirer/prompts'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { parseRepo, repoSlug } from '../src/shared/repo'
import type { PublishProgress, SyncActionKind } from '../src/shared/studio'
import type { RepoRef } from '../src/shared/types'
import { resolveCredential } from '../src/main/auth'
import { setGitHubApiOverride } from '../src/main/githubEnv'
import { getSettings } from '../src/main/settings'
import { describeError } from '../src/main/studio/analyze'
import { StudioService } from '../src/main/studio/service'
import { defaultWorkspaceDir, loadWorkspaceDir } from '../src/main/studio/settings'

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    dir: { type: 'string' },
    repo: { type: 'string' },
    yes: { type: 'boolean', short: 'y', default: false },
    'dry-run': { type: 'boolean', default: false }
  }
})

const c = {
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`
}

function formatBytes(bytes: number): string {
  const units = ['o', 'Ko', 'Mo', 'Go']
  let i = 0
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024
    i++
  }
  return `${bytes.toLocaleString('fr-FR', { maximumFractionDigits: i ? 1 : 0 })} ${units[i]}`
}

async function workspaceDir(): Promise<string> {
  if (args.dir) return resolve(args.dir)
  if (process.env.MODPACKS_DIR) return resolve(process.env.MODPACKS_DIR)
  const fromStudio = await loadWorkspaceDir()
  if (fromStudio) return fromStudio
  if (existsSync(defaultWorkspaceDir())) return defaultWorkspaceDir()
  throw new Error(`Aucun dossier de modpacks : lance le studio (npm run studio) ou passe --dir <dossier>.`)
}

setGitHubApiOverride(process.env.MPD_GITHUB_API)

async function repository(): Promise<RepoRef> {
  if (!args.repo) return (await getSettings()).repo
  const repo = parseRepo(args.repo)
  if (!repo) throw new Error(`Dépôt invalide : ${args.repo} (format attendu : propriétaire/dépôt).`)
  return repo
}

async function createService(): Promise<StudioService> {
  const dir = await workspaceDir()
  if (!existsSync(dir)) throw new Error(`Dossier introuvable : ${dir}`)
  const repo = await repository()
  console.log(c.dim(`Dossier des modpacks : ${dir}\nDépôt GitHub : ${repoSlug(repo)}\n`))
  let analyzing: string | null = null
  return new StudioService({
    getWorkspaceDir: () => dir,
    defaultWorkspaceDir: defaultWorkspaceDir(),
    // Les scripts publient sans passer par le choix du rôle : c'est l'outil de l'auteur.
    getAppSettings: async () => ({ role: 'publisher', repo }),
    getCredential: () => resolveCredential({ dotenvDir: process.cwd() }),
    onAnalyzing: (fileName) => {
      if (fileName && fileName !== analyzing) console.log(c.dim(`  Analyse de ${fileName}…`))
      analyzing = fileName
    }
  })
}

async function ranger(): Promise<void> {
  const service = await createService()
  const plan = await service.rangerPlan()
  if (plan.total === 0 && plan.packs.every((p) => !p.errors.length)) {
    console.log(c.green('✔ Tout est déjà rangé.\n'))
    return
  }
  for (const pack of plan.packs) {
    console.log(c.bold(pack.name))
    for (const error of pack.errors) console.log(`  ${c.red('✖')} ${error}`)
    for (const rename of pack.renames) {
      console.log(`  ${rename.from}  →  ${c.green(rename.to)}`)
      if (rename.warning) console.log(`    ${c.yellow('⚠')} ${rename.warning}`)
    }
    console.log()
  }
  if (plan.total === 0) return
  if (!args.yes && !(await confirm({ message: `Renommer ${plan.total} fichier${plan.total > 1 ? 's' : ''} ?`, default: true }))) {
    console.log('Annulé.')
    return
  }
  const renamed = await service.applyRanger()
  console.log(c.green(`\n✔ ${renamed} fichier${renamed > 1 ? 's' : ''} renommé${renamed > 1 ? 's' : ''}.\n`))
}

const KIND_LABELS: Record<SyncActionKind, (s: string) => string> = {
  create: (s) => c.green(`+ ${s}`),
  update: (s) => c.yellow(`~ ${s}`),
  delete: (s) => c.red(`− ${s}`)
}

async function publier(): Promise<void> {
  const service = await createService()
  console.log(c.dim('Comparaison avec GitHub…'))
  const { view: plan } = await service.freshPlan()
  const github = service.githubStatus
  console.log(c.dim(`GitHub : ${github.login ?? 'connecté'} (connexion : ${github.tokenSource})${github.repoPrivate ? ' · dépôt privé, invisible pour les joueurs' : ''}\n`))

  if (plan.pendingZips > 0) {
    console.log(c.yellow(`⚠ ${plan.pendingZips} zip${plan.pendingZips > 1 ? 's' : ''} pas encore rangé${plan.pendingZips > 1 ? 's' : ''} : ignoré${plan.pendingZips > 1 ? 's' : ''} (npm run modpacks:ranger).\n`))
  }
  for (const warning of plan.warnings) console.log(c.yellow(`⚠ ${warning}`))
  if (plan.warnings.length) console.log()

  if (plan.actions.length === 0) {
    console.log(c.green('✔ GitHub est déjà à jour.\n'))
    return
  }
  for (const action of plan.actions) {
    console.log(KIND_LABELS[action.kind](c.bold(action.label)))
    for (const detail of action.details) console.log(c.dim(`    ${detail}`))
    for (const warning of action.warnings) console.log(`    ${c.yellow('⚠')} ${warning}`)
  }
  const deletions = plan.actions.filter((a) => a.kind === 'delete').length
  console.log(c.dim(`\n${plan.actions.length} changement${plan.actions.length > 1 ? 's' : ''} · ${formatBytes(plan.uploadBytes)} à envoyer\n`))
  if (args['dry-run']) return

  const question = deletions
    ? `Publier ? (${deletions} release${deletions > 1 ? 's' : ''} sera${deletions > 1 ? 'ont' : ''} supprimée${deletions > 1 ? 's' : ''} de GitHub)`
    : 'Publier ?'
  if (!args.yes && !(await confirm({ message: question, default: deletions === 0 }))) {
    console.log('Annulé.')
    return
  }

  const controller = new AbortController()
  process.once('SIGINT', () => controller.abort())
  const printed = new Map<number, string>()
  let barShown = false
  const onProgress = (progress: PublishProgress) => {
    progress.steps.forEach((step, i) => {
      if (printed.get(i) === step.status || step.status === 'pending' || step.status === 'skipped') return
      if (barShown) process.stdout.write('\n')
      barShown = false
      printed.set(i, step.status)
      if (step.status === 'running') console.log(`${KIND_LABELS[step.kind](step.label)}`)
      else if (step.status === 'done') console.log(c.green('  ✔ fait'))
      else if (step.status === 'error') console.log(c.red(`  ✖ ${step.error}`))
    })
    const current = progress.current
    if (current && current.total > 0) {
      const ratio = current.done / current.total
      const bar = '█'.repeat(Math.round(ratio * 28)).padEnd(28, '░')
      const speed = current.bytesPerSecond ? ` · ${formatBytes(current.bytesPerSecond)}/s` : ''
      process.stdout.write(`\r  ${current.text.padEnd(34).slice(0, 34)} ${c.green(bar)} ${(ratio * 100).toFixed(0).padStart(3)} %${speed}      `)
      barShown = true
    }
  }
  const result = await service.publish(plan.fingerprint, onProgress, controller.signal)
  if (barShown) process.stdout.write('\n')
  if (result.ok) console.log(c.green(`\n✔ GitHub est à jour (${result.done} changement${result.done > 1 ? 's' : ''}).\n`))
  else throw new Error(result.error)
}

async function main(): Promise<void> {
  const command = positionals[0]
  if (command === 'ranger') await ranger()
  else if (command === 'publier') await publier()
  else throw new Error('Commande inconnue : utilise « ranger » ou « publier ».')
}

main().catch((err: unknown) => {
  if (err instanceof Error && err.name === 'ExitPromptError') process.exit(130)
  console.error(c.red(`\n✖ ${describeError(err)}\n`))
  process.exit(1)
})
