import { useState, useCallback } from 'react'
import { Settings } from '../types'
import { loadSettings, saveSettings } from '../store/settingsStore'

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings())

  const update = useCallback((next: Settings) => {
    saveSettings(next)
    setSettings(next)
  }, [])

  return { settings, update }
}
