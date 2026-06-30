import { Message, Settings } from '../types'
import { streamLLM } from './llm'

export type StepStatus = 'todo' | 'running' | 'done' | 'error'

export interface PlanStep {
  title: string
  detail: string
  status: StepStatus
}

// 依對話產生分步建構計畫（3-6 步）
export async function proposePlan(llm: Settings['llm'], messages: Message[]): Promise<PlanStep[]> {
  const systemPrompt =
    '你是資深前端工程師，要把「生成這個網頁工具」拆解成 3 至 6 個可逐步實作的步驟。' +
    '第一步應該是做出可運作的基礎版本，後續每步加入一項功能。' +
    '只輸出 JSON：{"steps":[{"title":"簡短標題","detail":"一句說明"}]}，使用繁體中文。'
  const full = await streamLLM({ settings: llm, systemPrompt, messages, json: true, onChunk: () => {} })
  const match = full.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('no plan')
  const obj = JSON.parse(match[0]) as Record<string, unknown>
  if (!Array.isArray(obj.steps)) throw new Error('invalid plan')
  const steps = obj.steps
    .filter((s): s is { title: string; detail?: string } => !!s && typeof (s as { title?: unknown }).title === 'string')
    .map((s): PlanStep => ({ title: s.title.trim(), detail: typeof s.detail === 'string' ? s.detail.trim() : '', status: 'todo' }))
  if (steps.length === 0) throw new Error('empty plan')
  return steps.slice(0, 8)
}
