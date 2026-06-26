// 資料來源解析與摘要：CSV → 物件陣列、JSON → 解析後的值
import { DataSource } from '../types'
import { readFileAsText } from './opfs'

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}

export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim() !== '')
  if (lines.length === 0) return []
  const headers = parseCsvLine(lines[0])
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? ''
    })
    return row
  })
}

// 依副檔名解析檔案內容。CSV → 物件陣列；JSON → 解析後的值；其他 → 原始文字。
export function parseData(name: string, text: string): unknown {
  const lower = name.toLowerCase()
  if (lower.endsWith('.csv')) return parseCsv(text)
  if (lower.endsWith('.json')) {
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  }
  return text
}

// 產生給 LLM system prompt 的簡短 schema 摘要
export function summarizeData(name: string, text: string): string {
  const parsed = parseData(name, text)
  if (Array.isArray(parsed)) {
    const columns = parsed.length ? Object.keys(parsed[0] as object) : []
    const sample = parsed.slice(0, 2)
    return `${name}：共 ${parsed.length} 筆，欄位 [${columns.join(', ')}]；範例 ${JSON.stringify(sample)}`
  }
  if (parsed && typeof parsed === 'object') {
    return `${name}：JSON 物件，頂層鍵 [${Object.keys(parsed).join(', ')}]`
  }
  const preview = String(text).slice(0, 120)
  return `${name}：文字內容，開頭「${preview}」`
}

// 讀取工具已綁定的資料來源，組成給 system prompt 的摘要
export async function summarizeBoundData(dataSources: DataSource[]): Promise<string> {
  const parts: string[] = []
  for (const ds of dataSources) {
    if (ds.type === 'file') {
      try {
        const text = await readFileAsText(ds.opfsPath)
        parts.push(summarizeData(ds.name, text))
      } catch {
        parts.push(`${ds.name}：（無法讀取檔案）`)
      }
    } else if (ds.type === 'api') {
      parts.push(`${ds.name}：API ${ds.url}`)
    } else if (ds.type === 'mcp') {
      parts.push(`${ds.name}：MCP server`)
    }
  }
  return parts.join('\n')
}
