import { theme, Typography } from 'antd'
import { Message } from '../types'
import Markdown from './Markdown'

interface Props {
  message?: Message
  // 串流中的暫時泡泡
  streaming?: boolean
  streamText?: string
}

export default function ChatMessage({ message, streaming, streamText }: Props) {
  const { token } = theme.useToken()
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
          background: isUser ? token.colorPrimary : token.colorFillSecondary,
          color: isUser ? '#fff' : token.colorText,
          border: isUser ? 'none' : `1px solid ${token.colorBorderSecondary}`,
          wordBreak: 'break-word',
        }}
      >
        {isUser ? (
          <Typography.Text style={{ color: '#fff', whiteSpace: 'pre-wrap' }}>{content}</Typography.Text>
        ) : (
          <>
            <Markdown>{content}</Markdown>
            {streaming && <span className="wc-caret">▌</span>}
          </>
        )}
      </div>
    </div>
  )
}
