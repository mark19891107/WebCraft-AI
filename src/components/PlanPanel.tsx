import { Card, Typography, Button, Space, Spin } from 'antd'
import {
  CheckCircleFilled,
  CloseCircleFilled,
  DeleteOutlined,
  ThunderboltOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons'
import { PlanStep } from '../services/plan'

interface Props {
  steps: PlanStep[]
  running: boolean
  onRemove: (index: number) => void
  onStart: () => void
  onSkip: () => void
  onCancel: () => void
}

function StatusIcon({ status }: { status: PlanStep['status'] }) {
  if (status === 'done') return <CheckCircleFilled style={{ color: '#52c41a' }} />
  if (status === 'running') return <Spin size="small" />
  if (status === 'error') return <CloseCircleFilled style={{ color: '#ff4d4f' }} />
  return <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', border: '1px solid #888' }} />
}

export default function PlanPanel({ steps, running, onRemove, onStart, onSkip, onCancel }: Props) {
  const hasError = steps.some((s) => s.status === 'error')
  const allDone = steps.every((s) => s.status === 'done')

  return (
    <Card size="small" style={{ marginBottom: 12 }} title="建構計畫">
      <Space direction="vertical" style={{ width: '100%' }} size="small">
        {steps.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ marginTop: 2 }}>
              <StatusIcon status={s.status} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Typography.Text strong delete={s.status === 'error'}>
                {i + 1}. {s.title}
              </Typography.Text>
              {s.detail && (
                <div>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {s.detail}
                  </Typography.Text>
                </div>
              )}
            </div>
            {!running && s.status === 'todo' && steps.length > 1 && (
              <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => onRemove(i)} />
            )}
          </div>
        ))}

        {!running && !allDone && (
          <Space wrap style={{ marginTop: 4 }}>
            <Button type="primary" icon={hasError ? <PlayCircleOutlined /> : <ThunderboltOutlined />} onClick={onStart}>
              {hasError ? '繼續建構' : '開始建構'}
            </Button>
            {!hasError && <Button onClick={onSkip}>直接生成（跳過分步）</Button>}
            <Button type="text" onClick={onCancel}>
              取消
            </Button>
          </Space>
        )}
      </Space>
    </Card>
  )
}
