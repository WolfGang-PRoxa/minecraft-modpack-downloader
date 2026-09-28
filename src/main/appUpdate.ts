import { app, shell } from 'electron'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import type { AppUpdateInfo, AppUpdateProgress } from '../shared/types'
import { downloadFile } from './download'

/** Télécharge le nouvel installateur, le lance puis ferme l'application. */
export async function installAppUpdate(
  update: AppUpdateInfo,
  onProgress: (progress: AppUpdateProgress) => void
): Promise<{ ok: boolean; error?: string }> {
  if (!update.installerUrl) {
    await shell.openExternal(update.releaseUrl)
    return { ok: true }
  }
  try {
    const destination = join(app.getPath('temp'), 'modpack-downloader', `Modpack-Downloader-Setup-${update.version}.exe`)
    await downloadFile({
      url: update.installerUrl,
      destination,
      expectedSize: update.installerSize,
      onProgress: ({ done, total }) => onProgress({ done, total })
    })
    const child = spawn(destination, [], { detached: true, stdio: 'ignore' })
    child.on('error', () => {})
    child.unref()
    setTimeout(() => app.quit(), 500)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
