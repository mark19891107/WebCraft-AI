import { ApiMessage, AgentToolDef, AgentEvent, AgentChatFn, ToolCallRequest } from './types'

const DEFAULT_MAX_STEPS = 12

export interface RunAgentOptions {
  chat: AgentChatFn // 依賴注入，方便測試
  tools: AgentToolDef[]
  systemPrompt: string
  conversation: ApiMessage[] // 使用者對話（不含 system）
  maxSteps?: number
  signal?: AbortSignal
  onEvent?: (e: AgentEvent) => void
}

export interface RunAgentResult {
  summary: string
  steps: number
}

function parseArgs(tc: ToolCallRequest): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(tc.arguments || '{}')
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return null
  }
}

function toolDetail(name: string, args: Record<string, unknown> | null): string {
  if (!args) return ''
  if (name === 'write_tool_code') {
    const html = typeof args.html === 'string' ? args.html : ''
    return `${html.length} 字元`
  }
  if (name === 'patch_tool_code') {
    const find = typeof args.find === 'string' ? args.find : ''
    return `find: ${find.slice(0, 40)}${find.length > 40 ? '…' : ''}`
  }
  if (name === 'read_data') {
    return typeof args.name === 'string' && args.name ? args.name : '全部來源'
  }
  return ''
}

/**
 * Deep Agent Phase 1 迴圈：
 * LLM 回應 → 有 tool_calls 就執行並回饋 → 直到 finish / 純文字回覆 / 步數用盡。
 */
export async function runAgent(opts: RunAgentOptions): Promise<RunAgentResult> {
  const { chat, tools, systemPrompt, conversation, signal, onEvent } = opts
  const maxSteps = opts.maxSteps ?? DEFAULT_MAX_STEPS

  const messages: ApiMessage[] = [{ role: 'system', content: systemPrompt }, ...conversation]

  for (let step = 1; step <= maxSteps; step++) {
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError')

    const res = await chat(messages, tools, signal)

    if (res.content.trim()) onEvent?.({ type: 'assistant_text', text: res.content.trim() })

    // 沒有工具呼叫 → 純文字即為最終回覆
    if (res.toolCalls.length === 0) {
      const summary = res.content.trim() || '（完成）'
      onEvent?.({ type: 'done', summary })
      return { summary, steps: step }
    }

    // 記錄 assistant 的 tool_calls 訊息
    messages.push({
      role: 'assistant',
      content: res.content || null,
      tool_calls: res.toolCalls.map((tc) => ({
        id: tc.id || tc.name,
        type: 'function' as const,
        function: { name: tc.name, arguments: tc.arguments },
      })),
    })

    for (const tc of res.toolCalls) {
      if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
      const args = parseArgs(tc)
      onEvent?.({ type: 'tool_start', name: tc.name, detail: toolDetail(tc.name, args) })

      // finish：明確結束
      if (tc.name === 'finish') {
        const summary =
          (args && typeof args.summary === 'string' && args.summary.trim()) || '已完成。'
        onEvent?.({ type: 'done', summary })
        return { summary, steps: step }
      }

      let result: string
      let isError = false
      const def = tools.find((t) => t.name === tc.name)
      if (!def) {
        result = `錯誤：沒有名為 "${tc.name}" 的工具。可用：${tools.map((t) => t.name).join(', ')}`
        isError = true
      } else if (args === null) {
        result = '錯誤：arguments 不是合法 JSON，請重新以正確的 JSON 呼叫。'
        isError = true
      } else {
        try {
          result = await def.execute(args)
        } catch (err) {
          result = `錯誤：${err instanceof Error ? err.message : String(err)}`
          isError = true
        }
      }

      onEvent?.({ type: 'tool_result', name: tc.name, result, isError })
      messages.push({ role: 'tool', tool_call_id: tc.id || tc.name, content: result })
    }
  }

  const summary = '已達步數上限，先停在目前進度。你可以再送一則訊息讓我繼續。'
  onEvent?.({ type: 'done', summary })
  return { summary, steps: maxSteps }
}
