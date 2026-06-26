import { useState, useRef, useCallback } from 'react'
import { Message, Settings } from '../types'
import { streamLLM } from '../services/llm'

export function useLLMStream() {
  const [streaming, setStreaming] = useState(false)
  const [streamText, setStreamText] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const start = useCallback(
    async (
      settings: Settings['llm'],
      systemPrompt: string,
      messages: Message[],
    ): Promise<string> => {
      abortRef.current = new AbortController()
      setStreaming(true)
      setStreamText('')
      try {
        const full = await streamLLM({
          settings,
          systemPrompt,
          messages,
          onChunk: (chunk) => setStreamText((prev) => prev + chunk),
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

  return { streaming, streamText, start, abort }
}
