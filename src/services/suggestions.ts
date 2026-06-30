import { Message, Settings } from '../types'
import { streamLLM } from './llm'

// 依對話/已生成的工具，提出 2-3 個「下一步改進」建議
export async function suggestNextSteps(
  llm: Settings['llm'],
  messages: Message[],
): Promise<string[]> {
  const systemPrompt =
    '根據以下對話與已生成的工具，提出 2 至 3 個使用者接下來可能想要的改進。' +
    '每個是簡短、可直接執行的祈使句（不超過 14 個字，例如「加上深色模式」「匯出成 CSV」）。' +
    '只輸出 JSON：{"suggestions":["...","..."]}，使用繁體中文。'
  try {
    const full = await streamLLM({ settings: llm, systemPrompt, messages, json: true, onChunk: () => {} })
    const match = full.match(/\{[\s\S]*\}/)
    if (!match) return []
    const obj = JSON.parse(match[0]) as Record<string, unknown>
    if (!Array.isArray(obj.suggestions)) return []
    return obj.suggestions
      .filter((s): s is string => typeof s === 'string')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 3)
  } catch {
    return []
  }
}
