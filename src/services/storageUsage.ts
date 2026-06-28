export interface StorageItem {
  key: string
  label: string
  bytes: number
}

export interface StorageUsage {
  totalBytes: number
  items: StorageItem[]
}

function labelFor(key: string): string {
  if (key === 'webcraft_tools') return '工具定義'
  if (key === 'webcraft_settings') return '系統設定'
  if (key.startsWith('webcraft_toolstore_')) return '工具資料（bridge.storage）'
  if (key === 'webcraft_theme') return '主題'
  return key
}

// localStorage 以 UTF-16 儲存，每字元約 2 bytes
function sizeOf(key: string, value: string): number {
  return (key.length + value.length) * 2
}

export function getStorageUsage(): StorageUsage {
  const items: StorageItem[] = []
  let totalBytes = 0
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key) continue
    const value = localStorage.getItem(key) ?? ''
    const bytes = sizeOf(key, value)
    totalBytes += bytes
    items.push({ key, label: labelFor(key), bytes })
  }
  items.sort((a, b) => b.bytes - a.bytes)
  return { totalBytes, items }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}
