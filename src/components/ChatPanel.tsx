import { useEffect, useRef } from 'react'
import { Input, Button, Empty, Grid, Typography, theme, Space, Tooltip, Popconfirm, Upload, message } from 'antd'
import {
  SendOutlined,
  StopOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  PictureOutlined,
  CloseCircleFilled,
} from '@ant-design/icons'
import { Message } from '../types'
import ChatMessage from './ChatMessage'

const { useBreakpoint } = Grid

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

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
  images?: string[]
  onAddImage?: (dataUrl: string) => void
  onRemoveImage?: (index: number) => void
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
  images = [],
  onAddImage,
  onRemoveImage,
}: Props) {
  async function handlePickImage(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      message.warning('圖片過大（請小於 5MB）')
      return false
    }
    try {
      onAddImage?.(await fileToDataUrl(file))
    } catch {
      message.error('讀取圖片失敗')
    }
    return false
  }
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
        {images.length > 0 && (
          <Space wrap style={{ marginBottom: 8 }}>
            {images.map((src, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <img
                  src={src}
                  alt="參考圖"
                  style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6 }}
                />
                <CloseCircleFilled
                  onClick={() => onRemoveImage?.(i)}
                  style={{ position: 'absolute', top: -6, right: -6, cursor: 'pointer', fontSize: 16 }}
                />
              </div>
            ))}
          </Space>
        )}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          {onAddImage && (
            <Upload accept="image/*" showUploadList={false} beforeUpload={handlePickImage}>
              <Tooltip title="附加參考圖（依模型支援）">
                <Button icon={<PictureOutlined />} disabled={streaming} />
              </Tooltip>
            </Upload>
          )}
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
