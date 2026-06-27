import { useEffect, useMemo, useRef } from 'react'
import { Empty } from 'antd'
import { ToolDefinition } from '../types'
import { injectBridge } from '../services/bridgeInject'
import { attachBridge } from '../services/bridge'

interface Props {
  code: string
  tool?: ToolDefinition
  title?: string
  // 工具執行期錯誤回報（供自動修復使用）
  onError?: (message: string) => void
}

/**
 * 在 sandbox iframe 中渲染生成的工具。
 * 使用 srcdoc（origin 為 null），sandbox 僅給 allow-scripts 以隔離。
 * 提供 tool 時會內聯注入 window.bridge 並掛上主頁面的 postMessage handler。
 */
export default function BridgeIframe({ code, tool, title = 'tool-preview', onError }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const srcDoc = useMemo(() => (code ? injectBridge(code) : ''), [code])

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe || !tool || !code) return
    const detach = attachBridge(iframe, tool)
    return detach
  }, [tool, code])

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe || !onError) return
    const handler = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return
      const data = event.data
      if (data && data.__wcToolError) onError(String(data.message ?? 'Unknown error'))
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [onError])

  if (!code) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
        <Empty description="尚無預覽，請先生成工具" />
      </div>
    )
  }

  return (
    <iframe
      ref={iframeRef}
      title={title}
      srcDoc={srcDoc}
      sandbox="allow-scripts"
      style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
    />
  )
}
