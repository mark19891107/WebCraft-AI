import { Empty, Tag, Space } from 'antd'
import { diffLines, diffStats } from '../services/diff'

interface Props {
  oldCode: string
  newCode: string
  isRoot?: boolean
}

const COLORS = {
  add: { bg: 'rgba(82, 196, 26, 0.16)', sign: '+' },
  del: { bg: 'rgba(255, 77, 79, 0.16)', sign: '-' },
  eq: { bg: 'transparent', sign: ' ' },
} as const

export default function DiffViewer({ oldCode, newCode, isRoot }: Props) {
  if (!newCode) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
        <Empty description="尚無版本可比較" />
      </div>
    )
  }

  const lines = diffLines(oldCode, newCode)
  const { added, removed } = diffStats(lines)

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <div style={{ position: 'sticky', top: 0, padding: '6px 12px', background: 'var(--ant-color-bg-container, #1f1f1f)' }}>
        <Space>
          {isRoot ? <Tag>根版本（與空白比較）</Tag> : <Tag color="blue">與上一版比較</Tag>}
          <Tag color="green">+{added}</Tag>
          <Tag color="red">−{removed}</Tag>
        </Space>
      </div>
      <pre style={{ margin: 0, padding: '0 12px 12px', fontSize: 12, fontFamily: 'monospace' }}>
        {lines.map((l, i) => (
          <div key={i} style={{ background: COLORS[l.type].bg, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            <span style={{ opacity: 0.6, userSelect: 'none' }}>{COLORS[l.type].sign} </span>
            {l.text || ' '}
          </div>
        ))}
      </pre>
    </div>
  )
}
