import { useEffect, useRef } from 'react'
import { Input, Button, Empty, Grid, Typography, theme, Space, Tooltip, Popconfirm } from 'antd'
import { SendOutlined, StopOutlined, ReloadOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { Message } from '../types'
import ChatMessage from './ChatMessage'

const { useBreakpoint } = Grid

interface Props {
  messages: Message[]
  streaming: boolean
  streamText: string
  input: string
  onInputChange: (value: string) => void
  onSend: () => void
  onAbort: () => void
  placeholder?: string
  belowMessages?: React.ReactNode
  onRegenerate?: () => void
  onEditLast?: () => void
  onDeleteLast?: () => void
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
  belowMessages,
  onRegenerate,
  onEditLast,
  onDeleteLast,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const screens = useBreakpoint()
  const { token } = theme.useToken()
  const isMobile = screens.md === false

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, streamText, belowMessages])

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
        {!streaming && belowMessages}
      </div>

      <div style={{ padding: 12, borderTop: `1px solid ${token.colorBorderSecondary}` }}>
        {!streaming && messages.some((m) => m.role === 'user') && (onRegenerate || onEditLast || onDeleteLast) && (
          <Space style={{ marginBottom: 8 }}>
            {onRegenerate && (
              <Tooltip title="重新生成最後一則">
                <Button size="small" icon={<ReloadOutlined />} onClick={onRegenerate}>
                  重新生成
                </Button>
              </Tooltip>
            )}
            {onEditLast && (
              <Tooltip title="把最後一則訊息載回輸入框修改">
                <Button size="small" icon={<EditOutlined />} onClick={onEditLast} />
              </Tooltip>
            )}
            {onDeleteLast && (
              <Popconfirm title="刪除最後一則來回？" okText="刪除" cancelText="取消" onConfirm={onDeleteLast}>
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            )}
          </Space>
        )}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <Input.TextArea
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder={placeholder}
            autoSize={{ minRows: 2, maxRows: 8 }}
            disabled={streaming}
            onKeyDown={(e) => {
              // 桌機：Enter 送出、Shift+Enter 換行；手機：Enter 一律換行（用送出鈕）
              if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
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
        {!isMobile && (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Enter 送出 · Shift+Enter 換行
          </Typography.Text>
        )}
      </div>
    </div>
  )
}
