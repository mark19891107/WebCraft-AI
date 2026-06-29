import { Message, Settings } from '../types'
import { streamLLM } from './llm'

export interface ToolMeta {
  name: string
  description: string
}

// 依對話為工具取一個簡短名稱與一句話描述
export async function suggestToolMeta(
  llm: Settings['llm'],
  messages: Message[],
): Promise<ToolMeta | null> {
  const systemPrompt =
    '根據以下對話，為這個網頁工具取一個簡短名稱與一句話描述。' +
    '只輸出 JSON：{"name":"...","description":"..."}，使用繁體中文，name 不超過 12 個字，description 不超過 30 個字。'
  try {
    const full = await streamLLM({ settings: llm, systemPrompt, messages, onChunk: () => {} })
    const match = full.match(/\{[\s\S]*\}/)
    if (!match) return null
    const obj = JSON.parse(match[0]) as Record<string, unknown>
    if (typeof obj.name !== 'string' || !obj.name.trim()) return null
    return {
      name: obj.name.trim(),
      description: typeof obj.description === 'string' ? obj.description.trim() : '',
    }
  } catch {
    return null
  }
}
