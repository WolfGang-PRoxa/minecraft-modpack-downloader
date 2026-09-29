import { BrowserWindow, dialog, ipcMain, shell, app } from 'electron'
import type { AppUpdateInfo, ModpackVersion, Settings, ShortcutLocation } from '../shared/types'
import { installAppUpdate } from './appUpdate'
import { getCurseForgeStatus, launchCurseForge, resolveInstancesDir } from './curseforge'
import { getCatalog } from './github'
import { cancelInstall, installModpack, listInstalled } from './installer'
import { getSettings, updateSettings } from './settings'
import { createShortcut, PLAYER_SHORTCUT, shortcutStatus } from './shortcut'

export function registerIpc(getWindow: () => BrowserWindow | null): void {
  const send = (channel: string, payload: unknown) => {
    const win = getWindow()
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload)
  }

  ipcMain.handle('catalog:get', (_e, force?: boolean) => getCatalog(Boolean(force)))

  ipcMain.handle('installed:list', async () => {
    const { dir } = await resolveInstancesDir(await getSettings())
    return listInstalled(dir)
  })

  ipcMain.handle('install:start', (_e, version: ModpackVersion) =>
    installModpack(version, (progress) => send('install:progress', progress))
  )
  ipcMain.handle('install:cancel', (_e, id: string) => cancelInstall(id))

  ipcMain.handle('curseforge:status', async () => getCurseForgeStatus(await getSettings()))
  ipcMain.handle('curseforge:launch', () => launchCurseForge())

  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:update', (_e, patch: Partial<Settings>) => {
    const allowed: Partial<Settings> = {}
    if ('instancesDir' in patch) allowed.instancesDir = patch.instancesDir || null
    if (typeof patch.openCurseForgeAfterInstall === 'boolean') {
      allowed.openCurseForgeAfterInstall = patch.openCurseForgeAfterInstall
    }
    if (typeof patch.shortcutPrompted === 'boolean') allowed.shortcutPrompted = patch.shortcutPrompted
    return updateSettings(allowed)
  })
  ipcMain.handle('settings:pickInstancesDir', async () => {
    const win = getWindow()
    const current = await resolveInstancesDir(await getSettings())
    const options: Electron.OpenDialogOptions = {
      title: 'Choisir le dossier Instances de CurseForge',
      defaultPath: current.dir,
      properties: ['openDirectory', 'createDirectory']
    }
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    if (result.canceled || !result.filePaths[0]) return null
    return updateSettings({ instancesDir: result.filePaths[0] })
  })

  ipcMain.handle('shortcut:status', () => shortcutStatus(PLAYER_SHORTCUT))
  ipcMain.handle('shortcut:create', async (_e, location: ShortcutLocation) => {
    const result = await createShortcut(PLAYER_SHORTCUT, location === 'choose' ? 'choose' : 'desktop', getWindow())
    // Une réponse a été donnée : le bandeau de premier lancement ne revient plus.
    if (result.ok) await updateSettings({ shortcutPrompted: true })
    return result
  })

  ipcMain.handle('shell:openPath', async (_e, path: string) => {
    await shell.openPath(path)
  })
  ipcMain.handle('shell:openExternal', async (_e, url: string) => {
    if (/^https:\/\//i.test(url)) await shell.openExternal(url)
  })

  ipcMain.handle('app:version', () => app.getVersion())
  ipcMain.handle('app:update', (_e, update: AppUpdateInfo) =>
    installAppUpdate(update, (progress) => send('app:update-progress', progress))
  )

  ipcMain.on('window:minimize', () => getWindow()?.minimize())
  ipcMain.on('window:toggleFullscreen', () => {
    const win = getWindow()
    if (!win) return
    const next = !win.isFullScreen()
    win.setFullScreen(next)
    if (!next) win.maximize()
  })
  ipcMain.on('window:close', () => getWindow()?.close())
}
