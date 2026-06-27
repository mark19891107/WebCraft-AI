import { Typography } from 'antd'
import { Message } from '../types'

interface Props {
  message?: Message
  // 串流中的暫時泡泡
  streaming?: boolean
  streamText?: string
}

export default function ChatMessage({ message, streaming, streamText }: Props) {
  const role = message?.role ?? 'assistant'
  const isUser = role === 'user'
  const content = streaming ? (streamText && streamText.trim() ? streamText : '生成中…') : message?.content ?? ''

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 12,
      }}
    >
      <div
        style={{
          maxWidth: '85%',
          padding: '8px 12px',
          borderRadius: 8,
          background: isUser ? '#1668dc' : '#1f1f1f',
          border: isUser ? 'none' : '1px solid #303030',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        <Typography.Text style={{ color: isUser ? '#fff' : undefined }}>
          {content}
          {streaming && <span className="wc-caret">▌</span>}
        </Typography.Text>
      </div>
    </div>
  )
}
