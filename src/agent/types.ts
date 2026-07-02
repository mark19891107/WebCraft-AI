// Deep Agent（Phase 1）共用型別

// OpenAI-compatible 的訊息（含 tool 往返），刻意保持寬鬆
export interface ApiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: ApiToolCall[]
  tool_call_id?: string
}

export interface ApiToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

// LLM 回傳的工具呼叫請求（arguments 為原始 JSON 字串）
export interface ToolCallRequest {
  id: string
  name: string
  arguments: string
}

// 工具定義：schema 給 LLM、execute 給 runtime
export interface AgentToolDef {
  name: string
  description: string
  parameters: Record<string, unknown> // JSON Schema
  execute: (args: Record<string, unknown>) => Promise<string>
}

// 給 UI 的活動事件
export type AgentEvent =
  | { type: 'assistant_text'; text: string }
  | { type: 'tool_start'; name: string; detail: string }
  | { type: 'tool_result'; name: string; result: string; isError: boolean }
  | { type: 'done'; summary: string }
  | { type: 'error'; message: string }

export interface AgentChatResult {
  content: string
  toolCalls: ToolCallRequest[]
}

export type AgentChatFn = (
  messages: ApiMessage[],
  tools: AgentToolDef[],
  signal?: AbortSignal,
) => Promise<AgentChatResult>
