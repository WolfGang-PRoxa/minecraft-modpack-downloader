import { homedir } from 'node:os'
import { join } from 'node:path'
import { readJson, writeJsonAtomic } from '../fsutil'

export const STUDIO_NAME = 'Modpack Studio'

/** Dossier de données du studio, partagé avec les scripts `modpacks:*` (%APPDATA%\Modpack Studio). */
export function studioDataDir(): string {
  return join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), STUDIO_NAME)
}

export const defaultWorkspaceDir = (): string => join(homedir(), 'Modpacks')

export interface StudioSettingsFile {
  workspaceDir: string | null
  /** Jeton GitHub chiffré par Windows (safeStorage), en base64. */
  encryptedToken: string | null
}

const settingsFile = () => join(studioDataDir(), 'studio-settings.json')

export async function loadStudioSettings(): Promise<StudioSettingsFile> {
  const data = await readJson<Partial<StudioSettingsFile>>(settingsFile())
  return {
    workspaceDir: typeof data?.workspaceDir === 'string' && data.workspaceDir ? data.workspaceDir : null,
    encryptedToken: typeof data?.encryptedToken === 'string' && data.encryptedToken ? data.encryptedToken : null
  }
}

export async function saveStudioSettings(settings: StudioSettingsFile): Promise<void> {
  await writeJsonAtomic(settingsFile(), settings)
}
