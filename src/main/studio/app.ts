import { app, BrowserWindow, dialog, ipcMain, Menu, net, protocol, safeStorage, shell } from 'electron'
import { watch, type FSWatcher } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { ActionResult, RangerOrders, StudioSettings } from '../../shared/studio'
import type { ShortcutLocation } from '../../shared/types'
import { resolveInstancesDir } from '../curseforge'
import { pathExists } from '../fsutil'
import { createShortcut, shortcutStatus, STUDIO_SHORTCUT } from '../shortcut'
import { AnalysisCache, describeError, StudioError } from './analyze'
import { listInstances } from './archive'
import { GITHUB_API, resolveToken } from './githubApi'
import { StudioService } from './service'
import { defaultWorkspaceDir, loadStudioSettings, saveStudioSettings, type StudioSettingsFile } from './settings'
import { COVER_EXTENSIONS, type LocalPack } from './workspace'

/** Protocole qui sert les images des modpacks à la fenêtre (enregistré avant `ready` dans index.ts). */
export const COVER_SCHEME = 'studio-media'

let mainWindow: BrowserWindow | null = null
let stored: StudioSettingsFile = { workspaceDir: null, encryptedToken: null }
let service: StudioService
let watcher: FSWatcher | null = null
let publishController: AbortController | null = null
let zipController: AbortController | null = null

function send(channel: string, payload?: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload)
}

function settings(): StudioSettings {
  return {
    workspaceDir: stored.workspaceDir,
    defaultWorkspaceDir: defaultWorkspaceDir(),
    hasStoredToken: Boolean(stored.encryptedToken)
  }
}

function storedToken(): string | null {
  if (!stored.encryptedToken) return null
  try {
    return safeStorage.decryptString(Buffer.from(stored.encryptedToken, 'base64'))
  } catch {
    return null
  }
}

function coverUrl(pack: LocalPack): string | null {
  if (!pack.cover) return null
  return `${COVER_SCHEME}://cover/${encodeURIComponent(pack.folder)}?v=${Math.floor(pack.cover.mtimeMs)}-${pack.cover.size}`
}

/** Prévient la fenêtre quand le contenu du dossier change (zip déposé dans l'Explorateur…). */
function restartWatcher(): void {
  watcher?.close()
  watcher = null
  const dir = stored.workspaceDir
  if (!dir) return
  let timer: NodeJS.Timeout | null = null
  try {
    watcher = watch(dir, { recursive: true }, (_event, fileName) => {
      if (fileName && (fileName.endsWith(AnalysisCache.FILE_NAME) || /\.(part|tmp)$/i.test(fileName))) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => send('studio:changed'), 700)
    })
    watcher.on('error', () => {
      watcher?.close()
      watcher = null
      send('studio:changed')
    })
  } catch {
    watcher = null
  }
}

async function setWorkspace(dir: string): Promise<void> {
  stored = { ...stored, workspaceDir: dir }
  await saveStudioSettings(stored)
  restartWatcher()
}

function registerCoverProtocol(): void {
  protocol.handle(COVER_SCHEME, async (request) => {
    const folder = decodeURIComponent(new URL(request.url).pathname.replace(/^\/+/, ''))
    const root = stored.workspaceDir
    if (root && folder && !/[\\/]/.test(folder) && folder !== '..') {
      for (const ext of COVER_EXTENSIONS) {
        const file = join(root, folder, `cover${ext}`)
        if (await pathExists(file)) return net.fetch(pathToFileURL(file).toString())
      }
    }
    return new Response(null, { status: 404 })
  })
}

async function action(run: () => Promise<unknown>): Promise<ActionResult> {
  try {
    await run()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: describeError(err) }
  }
}

function registerIpc(): void {
  const window = () => mainWindow ?? undefined

  ipcMain.handle('studio:overview', (_e, options?: { refreshRemote?: boolean }) => service.overview(options ?? {}))

  ipcMain.handle('studio:pickWorkspace', async () => {
    const options: Electron.OpenDialogOptions = {
      title: 'Dossier de tes modpacks',
      defaultPath: stored.workspaceDir ?? defaultWorkspaceDir(),
      properties: ['openDirectory', 'createDirectory']
    }
    const result = window() ? await dialog.showOpenDialog(window()!, options) : await dialog.showOpenDialog(options)
    if (result.canceled || !result.filePaths[0]) return false
    await setWorkspace(result.filePaths[0])
    return true
  })
  ipcMain.handle('studio:useDefaultWorkspace', () =>
    action(async () => {
      const dir = defaultWorkspaceDir()
      await mkdir(dir, { recursive: true })
      await setWorkspace(dir)
    })
  )
  ipcMain.handle('studio:setToken', async (_e, token: string | null) => {
    const value = token?.trim()
    if (value) {
      if (!safeStorage.isEncryptionAvailable()) throw new Error('Le chiffrement Windows est indisponible.')
      stored = { ...stored, encryptedToken: safeStorage.encryptString(value).toString('base64') }
    } else {
      stored = { ...stored, encryptedToken: null }
    }
    await saveStudioSettings(stored)
    return service.refreshRemote()
  })

  ipcMain.handle('studio:createPack', (_e, name: string) => action(() => service.createPack(name)))
  ipcMain.handle('studio:updatePackInfo', (_e, folder: string, info: { name: string; description: string }) =>
    action(() => service.updatePackInfo(folder, info))
  )
  ipcMain.handle('studio:pickCover', (_e, folder: string) =>
    action(async () => {
      const options: Electron.OpenDialogOptions = {
        title: 'Image de couverture (16:9 conseillé)',
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: COVER_EXTENSIONS.map((e) => e.slice(1)) }]
      }
      const result = window() ? await dialog.showOpenDialog(window()!, options) : await dialog.showOpenDialog(options)
      if (!result.canceled && result.filePaths[0]) await service.setCover(folder, result.filePaths[0])
    })
  )
  ipcMain.handle('studio:removeCover', (_e, folder: string) => action(() => service.setCover(folder, null)))
  ipcMain.handle('studio:setNotes', (_e, folder: string, version: number, notes: string) =>
    action(() => service.setNotes(folder, version, notes))
  )
  ipcMain.handle('studio:importFiles', async (_e, folder: string, paths: string[]) => {
    try {
      return { ok: true, ...(await service.importFiles(folder, paths)) }
    } catch (err) {
      return { ok: false, error: describeError(err) }
    }
  })

  ipcMain.handle('studio:rangerPlan', (_e, orders?: RangerOrders) => service.rangerPlan(orders))
  ipcMain.handle('studio:applyRanger', async (_e, orders?: RangerOrders) => {
    try {
      return { ok: true, renamed: await service.applyRanger(orders) }
    } catch (err) {
      return { ok: false, error: describeError(err) }
    }
  })

  ipcMain.handle('studio:publish', async (_e, fingerprint: string) => {
    publishController = new AbortController()
    try {
      return await service.publish(fingerprint, (progress) => send('studio:publish-progress', progress), publishController.signal)
    } catch (err) {
      return { ok: false, cancelled: false, error: describeError(err), done: 0 }
    } finally {
      publishController = null
    }
  })
  ipcMain.handle('studio:cancelPublish', () => publishController?.abort())

  ipcMain.handle('studio:listInstances', async () => {
    const { dir } = await resolveInstancesDir({ instancesDir: null })
    return { dir, instances: await listInstances(dir) }
  })
  ipcMain.handle('studio:zipInstance', async (_e, folder: string, instancePath: string, includeSaves: boolean) => {
    zipController = new AbortController()
    let lastEmit = 0
    try {
      const fileName = await service.zipInstance(
        folder,
        instancePath,
        includeSaves,
        (done, total) => {
          const now = Date.now()
          if (now - lastEmit < 120 && done < total) return
          lastEmit = now
          send('studio:zip-progress', { done, total })
        },
        zipController.signal
      )
      return { ok: true, fileName }
    } catch (err) {
      return { ok: false, error: describeError(err) }
    } finally {
      zipController = null
    }
  })
  ipcMain.handle('studio:cancelZip', () => zipController?.abort())

  ipcMain.handle('studio:shortcutStatus', () => shortcutStatus(STUDIO_SHORTCUT))
  ipcMain.handle('studio:createShortcut', (_e, location: ShortcutLocation) =>
    createShortcut(STUDIO_SHORTCUT, location === 'choose' ? 'choose' : 'desktop', mainWindow)
  )

  ipcMain.handle('studio:openPath', async (_e, path: string) => {
    if (!(await pathExists(path))) throw new StudioError('Ce dossier n’existe plus.')
    await shell.openPath(path)
  })
  ipcMain.handle('studio:openExternal', async (_e, url: string) => {
    if (/^https:\/\//i.test(url)) await shell.openExternal(url)
  })

  ipcMain.on('studio:minimize', () => mainWindow?.minimize())
  ipcMain.on('studio:toggleMaximize', () => {
    if (!mainWindow) return
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  })
  ipcMain.on('studio:close', () => mainWindow?.close())
}

function createWindow(baseDir: string): void {
  mainWindow = new BrowserWindow({
    title: 'Modpack Studio',
    width: 1360,
    height: 880,
    minWidth: 980,
    minHeight: 640,
    frame: false,
    show: false,
    backgroundColor: '#0a0d12',
    icon: app.isPackaged ? undefined : join(baseDir, '../../build/icon.png'),
    webPreferences: {
      preload: join(baseDir, '../preload/studio.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  mainWindow.once('ready-to-show', () => mainWindow?.show())

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  // Bloque aussi un fichier lâché hors d'une zone de dépôt, qui remplacerait la page.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow?.webContents.getURL()) event.preventDefault()
  })
  mainWindow.on('closed', () => {
    mainWindow = null
    publishController?.abort()
    zipController?.abort()
  })

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}/studio.html`)
  } else {
    void mainWindow.loadFile(join(baseDir, '../renderer/studio.html'))
  }
}

/**
 * Démarre la fenêtre de l'auteur (`--studio`). Le nom de l'application, son dossier de données,
 * le verrou d'instance unique et le protocole des images sont réglés avant `ready` dans index.ts.
 */
export function startStudio(baseDir: string): void {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })
  app.on('window-all-closed', () => app.quit())

  void app.whenReady().then(async () => {
    app.setAppUserModelId('com.wolfgangproxa.modpackstudio')
    Menu.setApplicationMenu(null)
    stored = await loadStudioSettings()
    service = new StudioService({
      getSettings: settings,
      getToken: () => resolveToken({ stored: storedToken() }),
      // En développement, MPD_GITHUB_API permet de publier vers un faux serveur de releases.
      apiBase: (!app.isPackaged && process.env.MPD_GITHUB_API) || GITHUB_API,
      coverUrl,
      onAnalyzing: (fileName) => send('studio:analyzing', fileName)
    })
    registerCoverProtocol()
    registerIpc()
    restartWatcher()
    createWindow(baseDir)
  })
}
