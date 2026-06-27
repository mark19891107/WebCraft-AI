import { useEffect, useRef } from 'react'
import { Input, Button, Empty } from 'antd'
import { SendOutlined, StopOutlined } from '@ant-design/icons'
import { Message } from '../types'
import ChatMessage from './ChatMessage'

interface Props {
  messages: Message[]
  streaming: boolean
  streamText: string
  input: string
  onInputChange: (value: string) => void
  onSend: () => void
  onAbort: () => void
  placeholder?: string
}

export default function ChatPanel({
  messages,
  streaming,
  streamText,
  input,
  onInputChange,
  onSend,
  onAbort,
  placeholder = '描述需求或要修改的地方…',
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, streamText])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 12, minHeight: 0 }}>
        {messages.length === 0 && !streaming ? (
          <Empty description={placeholder} />
        ) : (
          <>
            {messages.map((m, i) => (
              <ChatMessage key={i} message={m} />
            ))}
            {streaming && <ChatMessage streaming streamText={streamText} />}
          </>
        )}
      </div>

      <div style={{ padding: 12, borderTop: '1px solid #303030', display: 'flex', gap: 8 }}>
        <Input.TextArea
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder={placeholder}
          autoSize={{ minRows: 1, maxRows: 5 }}
          disabled={streaming}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault()
              onSend()
            }
          }}
        />
        {streaming ? (
          <Button danger icon={<StopOutlined />} onClick={onAbort}>
            停止
          </Button>
        ) : (
          <Button type="primary" icon={<SendOutlined />} onClick={onSend} disabled={!input.trim()}>
            送出
          </Button>
        )}
      </div>
    </div>
  )
}
