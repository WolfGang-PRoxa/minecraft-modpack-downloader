import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { RendererApi } from '../shared/types'

function subscribe<T>(channel: string, listener: (payload: T) => void): () => void {
  const handler = (_event: IpcRendererEvent, payload: T) => listener(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api: RendererApi = {
  getCatalog: (force) => ipcRenderer.invoke('catalog:get', force),
  getInstalled: () => ipcRenderer.invoke('installed:list'),
  install: (version) => ipcRenderer.invoke('install:start', version),
  cancelInstall: (id) => ipcRenderer.invoke('install:cancel', id),
  onInstallProgress: (listener) => subscribe('install:progress', listener),
  getCurseForgeStatus: () => ipcRenderer.invoke('curseforge:status'),
  launchCurseForge: () => ipcRenderer.invoke('curseforge:launch'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (patch) => ipcRenderer.invoke('settings:update', patch),
  pickInstancesDir: () => ipcRenderer.invoke('settings:pickInstancesDir'),
  openPath: (path) => ipcRenderer.invoke('shell:openPath', path),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  installAppUpdate: (update) => ipcRenderer.invoke('app:update', update),
  onAppUpdateProgress: (listener) => subscribe('app:update-progress', listener),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  toggleFullscreen: () => ipcRenderer.send('window:toggleFullscreen'),
  closeWindow: () => ipcRenderer.send('window:close'),
  onFullscreenChange: (listener) => subscribe('window:fullscreen', listener)
}

contextBridge.exposeInMainWorld('api', api)
