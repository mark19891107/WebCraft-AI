import { ToolDefinition, ExportedTool, ExportedDataSource } from '../types'
import { readFileAsText, getFileSize, writeFile, isOPFSSupported } from './opfs'

const MAX_EMBED_SIZE = 10 * 1024 * 1024 // 10 MB

function toBase64(text: string): string {
  return btoa(unescape(encodeURIComponent(text)))
}

function fromBase64(b64: string): string {
  return decodeURIComponent(escape(atob(b64)))
}

export async function exportTool(tool: ToolDefinition): Promise<ExportedTool> {
  const warnings: string[] = []
  const exportedSources: ExportedDataSource[] = []

  for (const ds of tool.dataSources) {
    if (ds.type === 'file') {
      try {
        const size = await getFileSize(ds.opfsPath)
        if (size <= MAX_EMBED_SIZE) {
          const text = await readFileAsText(ds.opfsPath)
          exportedSources.push({ ...ds, embedded: toBase64(text) })
        } else {
          exportedSources.push({ type: 'file', name: ds.name, opfsPath: ds.opfsPath })
          warnings.push(
            `檔案「${ds.name}」（${(size / 1024 / 1024).toFixed(1)} MB）過大未內嵌，接收方需自行上傳。`,
          )
        }
      } catch {
        exportedSources.push({ type: 'file', name: ds.name, opfsPath: ds.opfsPath })
        warnings.push(`無法讀取檔案「${ds.name}」以內嵌。`)
      }
    } else {
      exportedSources.push(ds)
    }
  }

  return {
    ...tool,
    dataSources: exportedSources,
    exportedAt: new Date().toISOString(),
    warnings: warnings.length ? warnings : undefined,
  }
}

export function downloadToolJson(exported: ExportedTool): void {
  const json = JSON.stringify(exported, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${exported.name.replace(/\s+/g, '-').toLowerCase() || 'tool'}.webcraft.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function importToolJson(file: File): Promise<ToolDefinition> {
  const text = await file.text()
  const data = JSON.parse(text) as ExportedTool
  const { exportedAt: _exportedAt, warnings: _warnings, ...toolData } = data

  const dataSources = []
  for (const ds of toolData.dataSources) {
    if (ds.type === 'file') {
      const { embedded, ...rest } = ds as ExportedDataSource & { type: 'file'; embedded?: string }
      // 若有內嵌資料且瀏覽器支援 OPFS，還原寫回本機
      if (embedded && isOPFSSupported()) {
        try {
          await writeFile(rest.opfsPath, new Blob([fromBase64(embedded)]))
        } catch {
          // 還原失敗則保留來源設定，使用者可自行重新上傳
        }
      }
      dataSources.push(rest)
    } else {
      dataSources.push(ds)
    }
  }

  return { ...toolData, dataSources } as ToolDefinition
}
