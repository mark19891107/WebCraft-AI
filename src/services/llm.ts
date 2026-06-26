import { Message, Settings } from '../types'

export interface LLMStreamOptions {
  settings: Settings['llm']
  systemPrompt: string
  messages: Message[]
  onChunk: (chunk: string) => void
  signal?: AbortSignal
}

// 去掉 endpoint 結尾斜線，避免出現 // 路徑
function normalizeEndpoint(endpoint: string): string {
  return endpoint.replace(/\/+$/, '')
}

/**
 * 串流 OpenAI-compatible chat completion。
 * 重點：跨 network chunk 緩衝未完成的 SSE 行，避免 data 行被切在 chunk 邊界時掉字。
 */
export async function streamLLM(options: LLMStreamOptions): Promise<string> {
  const { settings, systemPrompt, messages, onChunk, signal } = options
  const base = normalizeEndpoint(settings.endpoint)

  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      stream: true,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    }),
    signal,
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`LLM request failed: ${response.status} ${text}`)
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    // stream:true 讓多位元組字元跨 chunk 也能正確解碼
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    // 最後一段可能是未完成的行，留到下一輪
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      if (data === '[DONE]') return fullText
      try {
        const json = JSON.parse(data)
        const chunk: string = json.choices?.[0]?.delta?.content ?? ''
        if (chunk) {
          fullText += chunk
          onChunk(chunk)
        }
      } catch {
        // 不完整或非 JSON 的 SSE 行，略過
      }
    }
  }

  return fullText
}

/**
 * 測試 LLM 連線。先試 /models；不支援時退化為一次極小的 chat completion 探測。
 */
export async function testConnection(settings: Settings['llm']): Promise<boolean> {
  const base = normalizeEndpoint(settings.endpoint)
  const headers = { Authorization: `Bearer ${settings.apiKey}` }

  try {
    const res = await fetch(`${base}/models`, { headers })
    if (res.ok) return true
  } catch {
    // 忽略，往下退化探測
  }

  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: settings.model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      }),
    })
    return res.ok
  } catch {
    return false
  }
}
