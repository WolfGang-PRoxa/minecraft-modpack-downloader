import { execFile, spawn } from 'node:child_process'
import { open, readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { CURSEFORGE_OVERWOLF_UID } from '../shared/config'
import type { CurseForgeFlavor, CurseForgeStatus, Settings } from '../shared/types'
import { pathExists } from './fsutil'

const execFileAsync = promisify(execFile)

interface Launcher {
  flavor: CurseForgeFlavor
  command: string
  args: string[]
}

const localAppData = () => process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local')
const roamingAppData = () => process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming')

export const defaultInstancesDir = () => join(homedir(), 'curseforge', 'minecraft', 'Instances')

/** Découpe une ligne de commande Windows en respectant les guillemets. */
function splitCommandLine(commandLine: string): string[] {
  const tokens: string[] = []
  for (const match of commandLine.matchAll(/"([^"]*)"|(\S+)/g)) tokens.push(match[1] ?? match[2])
  return tokens
}

/** Commande associée au protocole curseforge:// (enregistrée par les deux versions de CurseForge). */
async function launcherFromProtocol(): Promise<Launcher | null> {
  try {
    const { stdout } = await execFileAsync('reg', ['query', 'HKCR\\curseforge\\shell\\open\\command', '/ve'], {
      windowsHide: true,
      timeout: 5000
    })
    const commandLine = /REG_(?:EXPAND_)?SZ\s+(.+)/.exec(stdout)?.[1]?.trim()
    if (!commandLine) return null
    const [command, ...rest] = splitCommandLine(commandLine)
    if (!command || !(await pathExists(command))) return null
    // On retire les arguments propres au lien cliqué (%1, --origin=urlscheme).
    const args = rest.filter((arg) => !arg.includes('%1') && !arg.startsWith('--origin'))
    const flavor: CurseForgeFlavor = /overwolf/i.test(commandLine) ? 'overwolf' : 'standalone'
    return { flavor, command, args }
  } catch {
    return null
  }
}

async function launcherFromKnownPaths(): Promise<Launcher | null> {
  const standalone = join(localAppData(), 'Programs', 'CurseForge Windows', 'CurseForge.exe')
  if (await pathExists(standalone)) return { flavor: 'standalone', command: standalone, args: [] }

  const programFilesX86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)'
  const overwolf = join(programFilesX86, 'Overwolf', 'OverwolfLauncher.exe')
  const extension = join(localAppData(), 'Overwolf', 'Extensions', CURSEFORGE_OVERWOLF_UID)
  if ((await pathExists(overwolf)) && (await pathExists(extension))) {
    return { flavor: 'overwolf', command: overwolf, args: ['-launchapp', CURSEFORGE_OVERWOLF_UID, '-from-desktop'] }
  }
  return null
}

async function findLauncher(): Promise<Launcher | null> {
  return (await launcherFromProtocol()) ?? (await launcherFromKnownPaths())
}

/**
 * Ouvre CurseForge. S'il tourne déjà, les deux versions (Overwolf et autonome)
 * se contentent de remettre leur fenêtre au premier plan.
 */
export async function launchCurseForge(): Promise<boolean> {
  const launcher = await findLauncher()
  if (!launcher) return false
  const child = spawn(launcher.command, launcher.args, { detached: true, stdio: 'ignore' })
  child.on('error', () => {})
  child.unref()
  return true
}

const LOG_PATTERN =
  /(?:Setting file watcher on instance directory|Resolving Minecraft instances list from) ([^"\r\n]+)/g

/**
 * CurseForge n'expose pas son dossier d'instances dans un fichier de réglages lisible,
 * mais l'écrit dans ses logs à chaque démarrage : on lit les plus récents.
 */
async function instancesDirFromLogs(): Promise<string | null> {
  const logDirs = [
    join(localAppData(), 'Overwolf', 'Log', 'Apps', 'CurseForge', 'CurseClient'),
    join(roamingAppData(), 'CurseForge', 'logs'),
    join(localAppData(), 'CurseForge', 'logs')
  ]
  const files: Array<{ path: string; mtime: number }> = []
  for (const dir of logDirs) {
    const names = await readdir(dir).catch(() => [] as string[])
    for (const name of names) {
      if (!/\.(json|log|txt)$/i.test(name)) continue
      const path = join(dir, name)
      const info = await stat(path).catch(() => null)
      if (info?.isFile()) files.push({ path, mtime: info.mtimeMs })
    }
  }
  files.sort((a, b) => b.mtime - a.mtime)

  for (const file of files.slice(0, 4)) {
    const handle = await open(file.path, 'r').catch(() => null)
    if (!handle) continue
    try {
      const buffer = Buffer.alloc(2 * 1024 * 1024)
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
      const text = buffer.toString('utf8', 0, bytesRead)
      let found: string | null = null
      for (const match of text.matchAll(LOG_PATTERN)) found = match[1]
      if (found) return found.trim().replace(/\\\\/g, '\\')
    } finally {
      await handle.close()
    }
  }
  return null
}

export async function resolveInstancesDir(
  settings: Settings
): Promise<{ dir: string; source: CurseForgeStatus['instancesDirSource'] }> {
  if (settings.instancesDir) return { dir: settings.instancesDir, source: 'settings' }
  const fromLogs = await instancesDirFromLogs()
  if (fromLogs) return { dir: fromLogs, source: 'curseforge' }
  return { dir: defaultInstancesDir(), source: 'default' }
}

export async function getCurseForgeStatus(settings: Settings): Promise<CurseForgeStatus> {
  const [launcher, { dir, source }] = await Promise.all([findLauncher(), resolveInstancesDir(settings)])
  return {
    installed: launcher !== null,
    flavor: launcher?.flavor ?? null,
    instancesDir: dir,
    instancesDirSource: source,
    instancesDirExists: await pathExists(dir)
  }
}

/** Indique si un Minecraft (java/javaw) tourne actuellement depuis ce dossier d'instance. */
export async function isGameRunningFrom(instancePath: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        "Get-CimInstance Win32_Process -Filter \"Name='javaw.exe' OR Name='java.exe'\" | ForEach-Object { $_.CommandLine }"
      ],
      { windowsHide: true, timeout: 15_000, maxBuffer: 16 * 1024 * 1024 }
    )
    const needle = instancePath.replace(/[\\/]+$/, '').toLowerCase()
    return stdout.toLowerCase().includes(needle)
  } catch {
    return false
  }
}
