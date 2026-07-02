import { describe, it, expect, vi } from 'vitest'
import { runAgent } from './runAgent'
import { AgentToolDef, AgentChatResult, ApiMessage } from './types'
import { mergeToolCallDeltas } from '../services/llm'

function echoTool(fn = vi.fn(async (args: Record<string, unknown>) => `echo:${args.text}`)): AgentToolDef {
  return {
    name: 'echo',
    description: 'echo back',
    parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
    execute: fn,
  }
}

const finishDef: AgentToolDef = {
  name: 'finish',
  description: 'done',
  parameters: { type: 'object', properties: { summary: { type: 'string' } }, required: ['summary'] },
  execute: async () => '完成',
}

// 依序回傳腳本化結果的假 chat
function scriptedChat(script: AgentChatResult[]) {
  let i = 0
  const seen: ApiMessage[][] = []
  const chat = async (messages: ApiMessage[]) => {
    seen.push([...messages])
    return script[Math.min(i++, script.length - 1)]
  }
  return { chat, seen }
}

describe('runAgent', () => {
  it('ends with plain text when no tool calls', async () => {
    const { chat } = scriptedChat([{ content: '請問要什麼顏色？', toolCalls: [] }])
    const r = await runAgent({ chat, tools: [echoTool(), finishDef], systemPrompt: 'sys', conversation: [] })
    expect(r.summary).toBe('請問要什麼顏色？')
    expect(r.steps).toBe(1)
  })

  it('executes a tool, feeds result back, then finishes', async () => {
    const exec = vi.fn(async (args: Record<string, unknown>) => `echo:${args.text}`)
    const { chat, seen } = scriptedChat([
      { content: '', toolCalls: [{ id: 't1', name: 'echo', arguments: '{"text":"hi"}' }] },
      { content: '', toolCalls: [{ id: 't2', name: 'finish', arguments: '{"summary":"完成了"}' }] },
    ])
    const r = await runAgent({ chat, tools: [echoTool(exec), finishDef], systemPrompt: 'sys', conversation: [] })
    expect(exec).toHaveBeenCalledWith({ text: 'hi' })
    expect(r.summary).toBe('完成了')
    // 第二輪 chat 應包含 tool 結果訊息
    const second = seen[1]
    expect(second.some((m) => m.role === 'tool' && m.content === 'echo:hi')).toBe(true)
  })

  it('reports invalid JSON args as a tool error and continues', async () => {
    const { chat, seen } = scriptedChat([
      { content: '', toolCalls: [{ id: 't1', name: 'echo', arguments: '{oops' }] },
      { content: '算了', toolCalls: [] },
    ])
    const r = await runAgent({ chat, tools: [echoTool()], systemPrompt: 'sys', conversation: [] })
    expect(r.summary).toBe('算了')
    const second = seen[1]
    const toolMsg = second.find((m) => m.role === 'tool')
    expect(toolMsg?.content).toContain('不是合法 JSON')
  })

  it('stops at maxSteps', async () => {
    const { chat } = scriptedChat([
      { content: '', toolCalls: [{ id: 't', name: 'echo', arguments: '{"text":"x"}' }] },
    ])
    const r = await runAgent({
      chat,
      tools: [echoTool()],
      systemPrompt: 'sys',
      conversation: [],
      maxSteps: 3,
    })
    expect(r.steps).toBe(3)
    expect(r.summary).toContain('步數上限')
  })

  it('reports unknown tool names back to the model', async () => {
    const { chat, seen } = scriptedChat([
      { content: '', toolCalls: [{ id: 't1', name: 'nope', arguments: '{}' }] },
      { content: 'ok', toolCalls: [] },
    ])
    await runAgent({ chat, tools: [echoTool()], systemPrompt: 'sys', conversation: [] })
    const toolMsg = seen[1].find((m) => m.role === 'tool')
    expect(toolMsg?.content).toContain('沒有名為')
  })
})

describe('mergeToolCallDeltas', () => {
  it('assembles a tool call across chunks', () => {
    let acc = mergeToolCallDeltas([], [{ index: 0, id: 'a', function: { name: 'echo', arguments: '{"te' } }])
    acc = mergeToolCallDeltas(acc, [{ index: 0, function: { arguments: 'xt":"hi"}' } }])
    expect(acc).toEqual([{ id: 'a', name: 'echo', arguments: '{"text":"hi"}' }])
  })

  it('handles multiple parallel tool calls by index', () => {
    const acc = mergeToolCallDeltas(
      [],
      [
        { index: 0, id: 'a', function: { name: 'x', arguments: '{}' } },
        { index: 1, id: 'b', function: { name: 'y', arguments: '{}' } },
      ],
    )
    expect(acc).toHaveLength(2)
    expect(acc[1]).toEqual({ id: 'b', name: 'y', arguments: '{}' })
  })
})
