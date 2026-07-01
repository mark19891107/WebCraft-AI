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

function clip(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}\n…（已截斷）` : s
}

const MAX_STRING = 120 // 單一字串值最長
const MAX_ARRAY = 3 // 陣列最多取樣幾筆
const MAX_DEPTH = 4 // 巢狀深度上限
const MAX_TOTAL = 1500 // 整段範例的最終保險上限

// 結構感知截斷：縮短過長字串、限制陣列筆數與深度，但保留所有欄位名
function truncateValue(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') {
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value
  }
  if (Array.isArray(value)) {
    if (depth >= MAX_DEPTH) return `[…共 ${value.length} 筆]`
    const head: unknown[] = value.slice(0, MAX_ARRAY).map((v) => truncateValue(v, depth + 1))
    if (value.length > MAX_ARRAY) head.push(`…共 ${value.length} 筆`)
    return head
  }
  if (value && typeof value === 'object') {
    if (depth >= MAX_DEPTH) return '{…}'
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) out[k] = truncateValue(v, depth + 1)
    return out
  }
  return value // number / boolean / null
}

function sampleJson(value: unknown): string {
  return clip(JSON.stringify(truncateValue(value), null, 2), MAX_TOTAL)
}

// 產生給 LLM system prompt 的 schema + 內容範例摘要
export function summarizeData(name: string, text: string): string {
  const parsed = parseData(name, text)
  if (Array.isArray(parsed)) {
    const first = parsed[0]
    const columns = first && typeof first === 'object' ? Object.keys(first as object) : []
    return `${name}：陣列，共 ${parsed.length} 筆，欄位 [${columns.join(', ')}]\n前幾筆範例：\n${sampleJson(parsed.slice(0, 2))}`
  }
  if (parsed && typeof parsed === 'object') {
    const keys = Object.keys(parsed as object)
    return `${name}：JSON 物件，頂層鍵 [${keys.join(', ')}]\n內容範例：\n${sampleJson(parsed)}`
  }
  return `${name}：文字內容，開頭：\n${clip(String(text), 300)}`
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
