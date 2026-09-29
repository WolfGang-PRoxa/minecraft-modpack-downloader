import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import type { StudioApi } from '../shared/studio'

// Pas de code partagé avec l'autre preload : en mode sandbox, un preload ne peut pas charger de module.
function subscribe<T>(channel: string, listener: (payload: T) => void): () => void {
  const handler = (_event: IpcRendererEvent, payload: T) => listener(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api: StudioApi = {
  getOverview: (options) => ipcRenderer.invoke('studio:overview', options),
  onChanged: (listener) => subscribe('studio:changed', listener),
  onAnalyzing: (listener) => subscribe('studio:analyzing', listener),

  pickWorkspaceDir: () => ipcRenderer.invoke('studio:pickWorkspace'),
  useDefaultWorkspace: () => ipcRenderer.invoke('studio:useDefaultWorkspace'),
  setToken: (token) => ipcRenderer.invoke('studio:setToken', token),

  createPack: (name) => ipcRenderer.invoke('studio:createPack', name),
  updatePackInfo: (folder, info) => ipcRenderer.invoke('studio:updatePackInfo', folder, info),
  pickCover: (folder) => ipcRenderer.invoke('studio:pickCover', folder),
  removeCover: (folder) => ipcRenderer.invoke('studio:removeCover', folder),
  setNotes: (folder, version, notes) => ipcRenderer.invoke('studio:setNotes', folder, version, notes),
  importFiles: (folder, paths) => ipcRenderer.invoke('studio:importFiles', folder, paths),

  getRangerPlan: (orders) => ipcRenderer.invoke('studio:rangerPlan', orders),
  applyRanger: (orders) => ipcRenderer.invoke('studio:applyRanger', orders),

  publish: (fingerprint) => ipcRenderer.invoke('studio:publish', fingerprint),
  cancelPublish: () => ipcRenderer.invoke('studio:cancelPublish'),
  onPublishProgress: (listener) => subscribe('studio:publish-progress', listener),

  listInstances: () => ipcRenderer.invoke('studio:listInstances'),
  zipInstance: (folder, instancePath, includeSaves) =>
    ipcRenderer.invoke('studio:zipInstance', folder, instancePath, includeSaves),
  cancelZip: () => ipcRenderer.invoke('studio:cancelZip'),
  onZipProgress: (listener) => subscribe('studio:zip-progress', listener),

  getShortcutStatus: () => ipcRenderer.invoke('studio:shortcutStatus'),
  createShortcut: (location) => ipcRenderer.invoke('studio:createShortcut', location),

  openPath: (path) => ipcRenderer.invoke('studio:openPath', path),
  openExternal: (url) => ipcRenderer.invoke('studio:openExternal', url),
  getPathForFile: (file) => webUtils.getPathForFile(file),

  minimizeWindow: () => ipcRenderer.send('studio:minimize'),
  toggleMaximize: () => ipcRenderer.send('studio:toggleMaximize'),
  closeWindow: () => ipcRenderer.send('studio:close')
}

contextBridge.exposeInMainWorld('studio', api)
