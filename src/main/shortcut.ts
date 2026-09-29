import { app, dialog, nativeImage, shell, type BrowserWindow } from 'electron'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { ShortcutLocation, ShortcutResult, ShortcutStatus } from '../shared/types'

export interface ShortcutSpec {
  /** Nom du fichier .lnk, sans extension. */
  name: string
  description: string
  /** Arguments passés à l'application (ex. --studio). */
  args: string[]
  appUserModelId: string
}

export const PLAYER_SHORTCUT: ShortcutSpec = {
  name: 'Modpack Downloader',
  description: 'Installer les modpacks Minecraft dans CurseForge',
  args: [],
  appUserModelId: 'com.wolfgangproxa.modpackdownloader'
}

export const STUDIO_SHORTCUT: ShortcutSpec = {
  name: 'Modpack Studio',
  description: 'Ranger et publier les modpacks sur GitHub',
  args: ['--studio'],
  appUserModelId: 'com.wolfgangproxa.modpackstudio'
}

const quote = (arg: string) => (/[\s"]/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg)

/**
 * Icône du raccourci : celle de l'exécutable une fois installé. En développement, l'exécutable est
 * electron.exe : on fabrique un .ico (une image PNG 256×256, format lu par Windows) depuis build/icon.png.
 */
async function shortcutIcon(): Promise<string> {
  if (app.isPackaged) return process.execPath
  const png = nativeImage.createFromPath(join(app.getAppPath(), 'build', 'icon.png'))
  if (png.isEmpty()) return process.execPath
  const data = png.resize({ width: 256, height: 256 }).toPNG()
  const header = Buffer.alloc(22)
  header.writeUInt16LE(1, 2) // type : icône
  header.writeUInt16LE(1, 4) // une image
  // Octets 6 et 7 à 0 : largeur et hauteur de 256.
  header.writeUInt16LE(1, 10) // plans de couleur
  header.writeUInt16LE(32, 12) // bits par pixel
  header.writeUInt32LE(data.length, 14)
  header.writeUInt32LE(22, 18) // position de l'image
  const file = join(app.getPath('userData'), 'shortcut.ico')
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, Buffer.concat([header, data]))
  return file
}

export function desktopShortcutPath(spec: ShortcutSpec): string {
  return join(app.getPath('desktop'), `${spec.name}.lnk`)
}

export function shortcutStatus(spec: ShortcutSpec): ShortcutStatus {
  const desktopPath = desktopShortcutPath(spec)
  return { desktopPath, onDesktop: existsSync(desktopPath) }
}

/** Crée (ou remplace) un raccourci vers l'application, sur le bureau ou à l'endroit choisi. */
export async function createShortcut(
  spec: ShortcutSpec,
  location: ShortcutLocation,
  window: BrowserWindow | null
): Promise<ShortcutResult> {
  let file = desktopShortcutPath(spec)
  if (location === 'choose') {
    const options: Electron.SaveDialogOptions = {
      title: 'Où créer le raccourci ?',
      defaultPath: file,
      buttonLabel: 'Créer le raccourci',
      filters: [{ name: 'Raccourci', extensions: ['lnk'] }]
    }
    const result = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return { ok: false, cancelled: true }
    file = /\.lnk$/i.test(result.filePath) ? result.filePath : `${result.filePath}.lnk`
  }

  // Non packagée, l'application se lance avec electron.exe suivi du dossier du projet.
  const args = app.isPackaged ? spec.args : [app.getAppPath(), ...spec.args]
  const icon = await shortcutIcon().catch(() => process.execPath)
  const ok = shell.writeShortcutLink(file, 'create', {
    target: process.execPath,
    args: args.map(quote).join(' '),
    cwd: dirname(process.execPath),
    description: spec.description,
    icon,
    iconIndex: 0,
    appUserModelId: spec.appUserModelId
  })
  return ok
    ? { ok: true, path: file }
    : { ok: false, cancelled: false, error: 'Windows a refusé de créer le raccourci à cet emplacement.' }
}
