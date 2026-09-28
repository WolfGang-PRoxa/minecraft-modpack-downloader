import { app } from 'electron'
import { join } from 'node:path'
import { readJson, writeJsonAtomic } from './fsutil'
import type { Settings } from '../shared/types'

const DEFAULTS: Settings = {
  instancesDir: null,
  openCurseForgeAfterInstall: true
}

let cached: Settings | null = null

function settingsFile(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export async function getSettings(): Promise<Settings> {
  if (!cached) {
    const stored = await readJson<Partial<Settings>>(settingsFile())
    cached = { ...DEFAULTS, ...stored }
  }
  return cached
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const next: Settings = { ...(await getSettings()), ...patch }
  await writeJsonAtomic(settingsFile(), next)
  cached = next
  return next
}
