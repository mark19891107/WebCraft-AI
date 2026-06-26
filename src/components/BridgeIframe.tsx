import { useMemo } from 'react'
import { Empty } from 'antd'

interface Props {
  code: string
  title?: string
}

/**
 * 在 sandbox iframe 中渲染生成的工具。
 * 使用 srcdoc（origin 為 null），sandbox 僅給 allow-scripts 以隔離。
 * Bridge（postMessage 通訊）將於 S6/S7 加入。
 */
export default function BridgeIframe({ code, title = 'tool-preview' }: Props) {
  const srcDoc = useMemo(() => code, [code])

  if (!code) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
        <Empty description="尚無預覽，請先生成工具" />
      </div>
    )
  }

  return (
    <iframe
      title={title}
      srcDoc={srcDoc}
      sandbox="allow-scripts"
      style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
    />
  )
}
