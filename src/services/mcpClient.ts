import { MCPServer, MCPTool } from '../types'

interface MCPSession {
  server: MCPServer
  tools: MCPTool[]
  sessionId?: string
}

const sessions = new Map<string, MCPSession>()

const PROTOCOL_VERSION = '2024-11-05'

// 從 SSE 文字中找出對應 id 的 JSON-RPC 回應
function parseSseForResult(text: string, id: number): unknown {
  let fallback: unknown
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) continue
    const data = trimmed.slice(5).trim()
    if (!data || data === '[DONE]') continue
    try {
      const json = JSON.parse(data)
      if (json.id === id) return json
      if (json.result !== undefined && fallback === undefined) fallback = json
    } catch {
      // 略過非 JSON 行
    }
  }
  return fallback
}

interface RpcOutcome {
  json: any
  sessionId?: string
}

async function postRpc(url: string, body: unknown, sessionId?: string): Promise<RpcOutcome> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  }
  if (sessionId) headers['Mcp-Session-Id'] = sessionId

  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
  const nextSession = res.headers.get('Mcp-Session-Id') ?? sessionId
  if (!res.ok) throw new Error(`MCP HTTP ${res.status}`)

  const ct = res.headers.get('content-type') ?? ''
  const id = (body as { id?: number }).id
  let json: unknown
  if (ct.includes('text/event-stream')) {
    json = parseSseForResult(await res.text(), id ?? -1)
  } else {
    const raw = await res.text()
    try {
      json = JSON.parse(raw)
    } catch {
      json = raw
    }
  }
  return { json, sessionId: nextSession ?? undefined }
}

export async function connectMCP(server: MCPServer): Promise<MCPTool[]> {
  const initBody = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'WebCraft AI', version: '0.1.0' },
    },
  }

  const { sessionId } = await postRpc(server.url, initBody)

  // 告知 server 初始化完成（notification，無 id）
  await postRpc(server.url, { jsonrpc: '2.0', method: 'notifications/initialized' }, sessionId).catch(
    () => undefined,
  )

  const { json } = await postRpc(
    server.url,
    { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
    sessionId,
  )

  const tools: MCPTool[] = json?.result?.tools ?? []
  sessions.set(server.id, { server, tools, sessionId })
  return tools
}

export async function callMCPTool(
  server: MCPServer,
  toolName: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  let session = sessions.get(server.id)
  if (!session) {
    await connectMCP(server)
    session = sessions.get(server.id)
  }
  const { json } = await postRpc(
    server.url,
    {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name: toolName, arguments: params },
    },
    session?.sessionId,
  )
  if (json?.error) throw new Error(json.error.message ?? 'MCP tool error')
  return json?.result
}

export function disconnectMCP(serverId: string): void {
  sessions.delete(serverId)
}

export function getConnectedTools(serverId: string): MCPTool[] {
  return sessions.get(serverId)?.tools ?? []
}
