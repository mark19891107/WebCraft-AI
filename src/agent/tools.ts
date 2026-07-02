import { ToolDefinition, DataSource } from '../types'
import { readFileAsText } from '../services/opfs'
import { summarizeData } from '../services/dataSource'
import { AgentToolDef } from './types'
import { testToolCode } from './toolTester'

export interface AgentToolContext {
  tool: ToolDefinition
  getCode: () => string
  // 更新工作中的程式碼（同步反映到 UI；版本於 agent 結束時一次提交）
  setCode: (code: string) => void
}

async function summarizeOne(ds: DataSource): Promise<string> {
  if (ds.type === 'file') {
    try {
      return summarizeData(ds.name, await readFileAsText(ds.opfsPath))
    } catch {
      return `${ds.name}：（無法讀取檔案）`
    }
  }
  if (ds.type === 'api') return `${ds.name}：API ${ds.url}（執行期以 bridge.api.fetch('${ds.name}') 取得）`
  return `${ds.name}：MCP server（執行期以 bridge.mcp 呼叫）`
}

export function buildAgentTools(ctx: AgentToolContext): AgentToolDef[] {
  return [
    {
      name: 'read_data',
      description: '讀取已綁定資料來源的格式與內容範例。不帶 name 時回傳全部來源的摘要。',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string', description: '資料來源名稱（可省略）' } },
        required: [],
      },
      execute: async (args) => {
        const name = typeof args.name === 'string' ? args.name.trim() : ''
        const sources = ctx.tool.dataSources
        if (sources.length === 0) return '此工具尚未綁定任何資料來源。'
        const targets = name ? sources.filter((d) => d.name === name) : sources
        if (targets.length === 0) {
          return `找不到資料來源 "${name}"。可用：${sources.map((d) => d.name).join(', ')}`
        }
        const parts = await Promise.all(targets.map(summarizeOne))
        return parts.join('\n\n')
      },
    },
    {
      name: 'write_tool_code',
      description: '以完整的單檔 HTML 覆寫工具程式碼（首次生成或大改時使用）。',
      parameters: {
        type: 'object',
        properties: { html: { type: 'string', description: '完整 HTML（含內聯 CSS/JS）' } },
        required: ['html'],
      },
      execute: async (args) => {
        const html = typeof args.html === 'string' ? args.html.trim() : ''
        if (!html || !html.includes('<')) return '錯誤：html 內容無效，請提供完整 HTML。'
        ctx.setCode(html)
        return `已寫入（${html.length} 字元）。請用 run_tool 測試。`
      },
    },
    {
      name: 'patch_tool_code',
      description:
        '對目前程式碼做一處精確取代（小改動時使用）。find 必須是目前程式碼中唯一的精確子字串。',
      parameters: {
        type: 'object',
        properties: {
          find: { type: 'string', description: '要被取代的原始片段（精確、唯一）' },
          replace: { type: 'string', description: '取代後的內容' },
        },
        required: ['find', 'replace'],
      },
      execute: async (args) => {
        const find = typeof args.find === 'string' ? args.find : ''
        const replace = typeof args.replace === 'string' ? args.replace : ''
        const code = ctx.getCode()
        if (!code) return '錯誤：目前沒有程式碼，請先用 write_tool_code。'
        if (!find) return '錯誤：find 不可為空。'
        if (!code.includes(find)) {
          return '錯誤：在目前程式碼中找不到 find 的內容。請先確認實際程式碼（可能與你記憶的不同），或改用 write_tool_code 覆寫。'
        }
        ctx.setCode(code.replace(find, replace))
        return '已套用修改。請用 run_tool 測試。'
      },
    },
    {
      name: 'run_tool',
      description: '在沙箱中實際執行目前的工具程式碼約 2 秒，回報執行期錯誤。寫完程式碼後務必呼叫。',
      parameters: { type: 'object', properties: {}, required: [] },
      execute: async () => {
        const code = ctx.getCode()
        if (!code) return '錯誤：目前沒有程式碼可測試。'
        const errors = await testToolCode(code, ctx.tool)
        if (errors.length === 0) return '執行測試通過：未偵測到錯誤。'
        return `偵測到 ${errors.length} 個錯誤：\n${errors.map((e) => `- ${e}`).join('\n')}\n請修正後再測試。`
      },
    },
    {
      name: 'finish',
      description: '所有工作完成（程式碼已通過 run_tool 測試）後呼叫，附上給使用者的簡短總結。',
      parameters: {
        type: 'object',
        properties: { summary: { type: 'string', description: '一兩句話總結做了什麼' } },
        required: ['summary'],
      },
      // finish 由 runAgent 特殊處理，不會實際執行到這裡
      execute: async () => '完成',
    },
  ]
}
