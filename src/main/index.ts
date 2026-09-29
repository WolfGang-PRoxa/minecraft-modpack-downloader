import { app, BrowserWindow, Menu, protocol, shell } from 'electron'
import { join } from 'node:path'
import { registerIpc } from './ipc'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    title: 'Modpack Downloader',
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    fullscreen: true,
    frame: false,
    show: false,
    backgroundColor: '#0a0d12',
    // Une fois packagée, l'application utilise l'icône intégrée à l'exécutable.
    icon: app.isPackaged ? undefined : join(__dirname, '../../build/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())

  const notifyFullscreen = () => mainWindow?.webContents.send('window:fullscreen', mainWindow.isFullScreen())
  mainWindow.on('enter-full-screen', notifyFullscreen)
  mainWindow.on('leave-full-screen', notifyFullscreen)

  // Les liens externes s'ouvrent dans le navigateur, jamais dans l'application.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow?.webContents.getURL()) event.preventDefault()
  })

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      event.preventDefault()
      const next = !mainWindow!.isFullScreen()
      mainWindow!.setFullScreen(next)
      if (!next) mainWindow!.maximize()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function startPlayer(): void {
  if (!app.requestSingleInstanceLock()) {
    app.quit()
    return
  }
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  app.whenReady().then(() => {
    app.setAppUserModelId('com.wolfgangproxa.modpackdownloader')
    Menu.setApplicationMenu(null)
    registerIpc(() => mainWindow)
    createWindow()
  })

  app.on('window-all-closed', () => app.quit())
}

// `--studio` ouvre l'outil de l'auteur (ranger et publier les modpacks) au lieu de l'application des joueurs.
if (process.argv.includes('--studio')) {
  // À régler avant `ready` : dossier de données et verrou d'instance propres au studio.
  app.setName('Modpack Studio')
  app.setPath('userData', join(app.getPath('appData'), 'Modpack Studio'))
  protocol.registerSchemesAsPrivileged([
    { scheme: 'studio-media', privileges: { standard: true, secure: true, supportFetchAPI: true } }
  ])
  if (!app.requestSingleInstanceLock()) app.quit()
  else void import('./studio/app').then((studio) => studio.startStudio(__dirname))
} else {
  startPlayer()
}
