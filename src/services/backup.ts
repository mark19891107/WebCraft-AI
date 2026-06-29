// 備份/還原：擷取所有 webcraft_* 的 localStorage 內容（工具、設定、各工具儲存、主題）

const PREFIX = 'webcraft'

interface Backup {
  type: 'webcraft-backup'
  version: 1
  exportedAt: string
  data: Record<string, string>
}

export function exportBackup(): void {
  const data: Record<string, string> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(PREFIX)) data[key] = localStorage.getItem(key) ?? ''
  }
  const backup: Backup = { type: 'webcraft-backup', version: 1, exportedAt: new Date().toISOString(), data }
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = `webcraft-backup-${stamp}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// 還原（覆蓋目前資料）。回傳還原的工具數量。
export async function importBackup(file: File): Promise<number> {
  const text = await file.text()
  const backup = JSON.parse(text) as Backup
  if (backup?.type !== 'webcraft-backup' || !backup.data) {
    throw new Error('invalid backup file')
  }
  Object.entries(backup.data).forEach(([key, value]) => {
    if (key.startsWith(PREFIX) && typeof value === 'string') localStorage.setItem(key, value)
  })
  try {
    const tools = JSON.parse(backup.data['webcraft_tools'] ?? '[]')
    return Array.isArray(tools) ? tools.length : 0
  } catch {
    return 0
  }
}
