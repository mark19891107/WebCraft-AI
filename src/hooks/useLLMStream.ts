import { useState, useRef, useCallback, useMemo } from 'react'
import { Message, Settings } from '../types'
import { streamLLM } from '../services/llm'
import { splitStream } from '../services/patch'

export function useLLMStream() {
  const [streaming, setStreaming] = useState(false)
  const [rawText, setRawText] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const split = useMemo(() => splitStream(rawText), [rawText])

  const start = useCallback(
    async (
      settings: Settings['llm'],
      systemPrompt: string,
      messages: Message[],
    ): Promise<string> => {
      abortRef.current = new AbortController()
      setStreaming(true)
      setRawText('')
      try {
        const full = await streamLLM({
          settings,
          systemPrompt,
          messages,
          onChunk: (chunk) => setRawText((prev) => prev + chunk),
          signal: abortRef.current.signal,
        })
        return full
      } finally {
        setStreaming(false)
      }
    },
    [],
  )

  const abort = useCallback(() => {
    abortRef.current?.abort()
    setStreaming(false)
  }, [])

  return {
    streaming,
    // 原始串流全文（供即時套用 patch 用）
    streamRaw: rawText,
    // 給人看的說明（對話框）
    streamExplanation: split.explanation,
    // 程式碼/patch（程式碼頁籤即時呈現）
    streamCode: split.code,
    streamInCode: split.inCode,
    start,
    abort,
  }
}
