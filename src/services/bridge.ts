import { BridgeRequest, BridgeResponse, ToolDefinition, DataSource, MCPServer } from '../types'
import { streamLLM } from './llm'
import { readFileAsText } from './opfs'
import { parseData } from './dataSource'
import { callMCPTool, getConnectedTools, connectMCP } from './mcpClient'
import { loadSettings } from '../store/settingsStore'

function reply(iframe: HTMLIFrameElement, msg: BridgeResponse) {
  iframe.contentWindow?.postMessage(msg, '*')
}

const norm = (s: string) => s.trim().toLowerCase()

/**
 * 容錯解析資料來源：精確名稱 → 忽略大小寫/空白 → 若該類型只有一個來源就用它。
 * 後者可救「LLM 把中文名翻成英文」導致名稱對不上的情況。
 */
function resolveDataSource(
  sources: DataSource[],
  type: 'file' | 'api',
  name: string,
): DataSource | undefined {
  const ofType = sources.filter((ds) => ds.type === type)
  return (
    ofType.find((ds) => ds.name === name) ??
    ofType.find((ds) => norm(ds.name) === norm(name)) ??
    (ofType.length === 1 ? ofType[0] : undefined)
  )
}

function resolveServer(servers: MCPServer[], name: string): MCPServer | undefined {
  return (
    servers.find((s) => s.name === name) ??
    servers.find((s) => norm(s.name) === norm(name)) ??
    (servers.length === 1 ? servers[0] : undefined)
  )
}

function availableNames(sources: DataSource[], type: string): string {
  const names = sources.filter((ds) => ds.type === type).map((ds) => ds.name)
  return names.length ? names.join(', ') : '（無）'
}

// 生成的工具自己的持久化儲存（依工具 id 隔離）
export const TOOL_STORE_PREFIX = 'webcraft_toolstore_'

function loadToolStore(toolId: string): Record<string, unknown> {
  try {
    return JSON.parse(localStorage.getItem(TOOL_STORE_PREFIX + toolId) ?? '{}')
  } catch {
    return {}
  }
}

function saveToolStore(toolId: string, data: Record<string, unknown>) {
  localStorage.setItem(TOOL_STORE_PREFIX + toolId, JSON.stringify(data))
}

async function handle(event: MessageEvent, iframe: HTMLIFrameElement, tool: ToolDefinition) {
  if (event.source !== iframe.contentWindow) return
  const req = event.data as BridgeRequest
  if (!req?.type || !req?.requestId) return

  const settings = loadSettings()
  const { requestId } = req

  try {
    switch (req.type) {
      case 'llm.chat': {
        if (!settings.llm.endpoint || !settings.llm.apiKey) {
          reply(iframe, { requestId, error: '尚未設定 LLM', done: true })
          return
        }
        const text = await streamLLM({
          settings: settings.llm,
          systemPrompt: req.system ?? 'You are a helpful assistant embedded in a web tool.',
          messages: req.messages,
          json: req.json,
          onChunk: (chunk) => reply(iframe, { requestId, chunk, done: false }),
        })
        reply(iframe, { requestId, result: text, done: true })
        break
      }

      case 'data.read': {
        const source = resolveDataSource(tool.dataSources, 'file', req.name)
        if (!source || source.type !== 'file') {
          reply(iframe, {
            requestId,
            error: `找不到資料來源 "${req.name}"（可用：${availableNames(tool.dataSources, 'file')}）`,
            done: true,
          })
          return
        }
        const text = await readFileAsText(source.opfsPath)
        const parsed = parseData(source.name, text)
        let result: unknown = parsed
        if (Array.isArray(parsed)) {
          const offset = req.offset ?? 0
          const rows = req.rows ?? parsed.length
          result = parsed.slice(offset, offset + rows)
        }
        reply(iframe, { requestId, result, done: true })
        break
      }

      case 'api.fetch': {
        const source = resolveDataSource(tool.dataSources, 'api', req.name)
        if (!source || source.type !== 'api') {
          reply(iframe, {
            requestId,
            error: `找不到 API 來源 "${req.name}"（可用：${availableNames(tool.dataSources, 'api')}）`,
            done: true,
          })
          return
        }
        const resp = await fetch(source.url, {
          ...req.options,
          headers: {
            ...source.headers,
            ...((req.options?.headers as Record<string, string>) ?? {}),
          },
        })
        const contentType = resp.headers.get('content-type') ?? ''
        const data = contentType.includes('application/json') ? await resp.json() : await resp.text()
        reply(iframe, { requestId, result: data, done: true })
        break
      }

      case 'storage.get': {
        const store = loadToolStore(tool.id)
        reply(iframe, { requestId, result: store[req.key] ?? null, done: true })
        break
      }

      case 'storage.set': {
        const store = loadToolStore(tool.id)
        store[req.key] = req.value
        saveToolStore(tool.id, store)
        reply(iframe, { requestId, result: null, done: true })
        break
      }

      case 'storage.remove': {
        const store = loadToolStore(tool.id)
        delete store[req.key]
        saveToolStore(tool.id, store)
        reply(iframe, { requestId, result: null, done: true })
        break
      }

      case 'storage.keys': {
        reply(iframe, { requestId, result: Object.keys(loadToolStore(tool.id)), done: true })
        break
      }

      case 'mcp.call': {
        const server = resolveServer(settings.mcpServers, req.serverName)
        if (!server) {
          reply(iframe, { requestId, error: `找不到 MCP server "${req.serverName}"`, done: true })
          return
        }
        const result = await callMCPTool(server, req.tool, req.params)
        reply(iframe, { requestId, result, done: true })
        break
      }

      case 'mcp.listTools': {
        const server = resolveServer(settings.mcpServers, req.serverName)
        if (!server) {
          reply(iframe, { requestId, error: `找不到 MCP server "${req.serverName}"`, done: true })
          return
        }
        let tools = getConnectedTools(server.id)
        if (tools.length === 0) tools = await connectMCP(server)
        reply(iframe, { requestId, result: tools, done: true })
        break
      }
    }
  } catch (err) {
    reply(iframe, { requestId, error: String(err), done: true })
  }
}

export function attachBridge(iframe: HTMLIFrameElement, tool: ToolDefinition): () => void {
  const handler = (event: MessageEvent) => handle(event, iframe, tool)
  window.addEventListener('message', handler)
  return () => window.removeEventListener('message', handler)
}
