import { Settings } from '../types'

const KEY = 'webcraft_settings'

const DEFAULT_SETTINGS: Settings = {
  llm: { endpoint: '', apiKey: '', model: 'gpt-4o' },
  mcpServers: [],
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(KEY, JSON.stringify(settings))
}
