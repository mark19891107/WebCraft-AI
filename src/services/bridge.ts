import { BridgeRequest, BridgeResponse, ToolDefinition } from '../types'
import { streamLLM } from './llm'
import { readFileAsText } from './opfs'
import { parseData } from './dataSource'
import { callMCPTool, getConnectedTools, connectMCP } from './mcpClient'
import { loadSettings } from '../store/settingsStore'

function reply(iframe: HTMLIFrameElement, msg: BridgeResponse) {
  iframe.contentWindow?.postMessage(msg, '*')
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
          systemPrompt: 'You are a helpful assistant embedded in a web tool.',
          messages: req.messages,
          onChunk: (chunk) => reply(iframe, { requestId, chunk, done: false }),
        })
        reply(iframe, { requestId, result: text, done: true })
        break
      }

      case 'data.read': {
        const source = tool.dataSources.find((ds) => ds.name === req.name && ds.type === 'file')
        if (!source || source.type !== 'file') {
          reply(iframe, { requestId, error: `找不到資料來源 "${req.name}"`, done: true })
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
        const source = tool.dataSources.find((ds) => ds.name === req.name && ds.type === 'api')
        if (!source || source.type !== 'api') {
          reply(iframe, { requestId, error: `找不到 API 來源 "${req.name}"`, done: true })
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

      case 'mcp.call': {
        const server = settings.mcpServers.find((s) => s.name === req.serverName)
        if (!server) {
          reply(iframe, { requestId, error: `找不到 MCP server "${req.serverName}"`, done: true })
          return
        }
        const result = await callMCPTool(server, req.tool, req.params)
        reply(iframe, { requestId, result, done: true })
        break
      }

      case 'mcp.listTools': {
        const server = settings.mcpServers.find((s) => s.name === req.serverName)
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
