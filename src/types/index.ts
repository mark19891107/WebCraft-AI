// src/types/index.ts
// 所有共用的 TypeScript 型別定義

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface ToolVersion {
  versionId: string
  parentVersionId: string | null
  createdAt: string
  label?: string
  code: string
  conversation: Message[]
}

export type DataSource =
  | { type: 'file'; name: string; opfsPath: string }
  | { type: 'api'; name: string; url: string; headers: Record<string, string> }
  | { type: 'mcp'; name: string; serverRef: string }

export interface ToolDefinition {
  id: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
  currentVersionId: string
  versions: ToolVersion[]
  dataSources: DataSource[]
  conversation: Message[]
}

export interface MCPServer {
  id: string
  name: string
  url: string
  transport: 'sse' | 'streamable-http'
}

export interface Settings {
  llm: {
    endpoint: string
    apiKey: string
    model: string
  }
  mcpServers: MCPServer[]
}

export interface MCPTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

// iframe 與主頁面之間的 postMessage 通訊協定
export type BridgeRequest =
  | { type: 'llm.chat'; requestId: string; messages: Message[]; stream?: boolean }
  | { type: 'data.read'; requestId: string; name: string; rows?: number; offset?: number }
  | { type: 'mcp.call'; requestId: string; serverName: string; tool: string; params: Record<string, unknown> }
  | { type: 'mcp.listTools'; requestId: string; serverName: string }
  | { type: 'api.fetch'; requestId: string; name: string; options?: RequestInit }
  | { type: 'storage.get'; requestId: string; key: string }
  | { type: 'storage.set'; requestId: string; key: string; value: unknown }
  | { type: 'storage.remove'; requestId: string; key: string }
  | { type: 'storage.keys'; requestId: string }

export type BridgeResponse =
  | { requestId: string; chunk: string; done: false }
  | { requestId: string; result: unknown; done: true }
  | { requestId: string; error: string; done: true }

export interface ExportedTool extends Omit<ToolDefinition, 'dataSources'> {
  dataSources: ExportedDataSource[]
  exportedAt: string
  warnings?: string[]
}

export type ExportedDataSource =
  | { type: 'file'; name: string; opfsPath: string; embedded?: string /* base64 */ }
  | { type: 'api'; name: string; url: string; headers: Record<string, string> }
  | { type: 'mcp'; name: string; serverRef: string }
