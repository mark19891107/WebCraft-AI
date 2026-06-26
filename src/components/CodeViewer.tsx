import { useEffect, useRef, useState } from 'react'
import { Button, message } from 'antd'
import { CopyOutlined } from '@ant-design/icons'
import hljs from 'highlight.js/lib/core'
import xml from 'highlight.js/lib/languages/xml'
import 'highlight.js/styles/github-dark.css'

hljs.registerLanguage('xml', xml)

interface Props {
  code: string
}

export default function CodeViewer({ code }: Props) {
  const ref = useRef<HTMLElement>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (ref.current) {
      ref.current.removeAttribute('data-highlighted')
      ref.current.textContent = code
      hljs.highlightElement(ref.current)
    }
  }, [code])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      message.success('已複製')
      setTimeout(() => setCopied(false), 1500)
    } catch {
      message.error('複製失敗')
    }
  }

  return (
    <div style={{ position: 'relative', height: '100%', overflow: 'auto' }}>
      <Button
        size="small"
        icon={<CopyOutlined />}
        onClick={handleCopy}
        style={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}
      >
        {copied ? '已複製' : '複製'}
      </Button>
      <pre style={{ margin: 0, padding: 12 }}>
        <code ref={ref} className="language-xml" style={{ fontSize: 12 }} />
      </pre>
    </div>
  )
}
