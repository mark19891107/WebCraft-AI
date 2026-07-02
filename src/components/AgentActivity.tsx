import { Card, Space, Spin, Tag, Typography } from 'antd'
import {
  CheckCircleFilled,
  CloseCircleFilled,
  DatabaseOutlined,
  CodeOutlined,
  ToolOutlined,
  PlayCircleOutlined,
  FlagOutlined,
} from '@ant-design/icons'
import { AgentEvent } from '../agent/types'

const TOOL_META: Record<string, { label: string; icon: React.ReactNode }> = {
  read_data: { label: '讀取資料', icon: <DatabaseOutlined /> },
  write_tool_code: { label: '寫入程式碼', icon: <CodeOutlined /> },
  patch_tool_code: { label: '修改程式碼', icon: <ToolOutlined /> },
  run_tool: { label: '測試執行', icon: <PlayCircleOutlined /> },
  finish: { label: '完成', icon: <FlagOutlined /> },
}

interface Props {
  events: AgentEvent[]
  running: boolean
}

export default function AgentActivity({ events, running }: Props) {
  if (events.length === 0 && !running) return null

  return (
    <Card size="small" title="🤖 Agent 活動" style={{ marginBottom: 12 }}>
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        {events.map((e, i) => {
          if (e.type === 'tool_start') {
            const meta = TOOL_META[e.name] ?? { label: e.name, icon: <ToolOutlined /> }
            const isLast = i === events.length - 1
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {running && isLast ? <Spin size="small" /> : <span style={{ width: 14 }}>{meta.icon}</span>}
                <Typography.Text>{meta.label}</Typography.Text>
                {e.detail && (
                  <Typography.Text type="secondary" style={{ fontSize: 12 }} ellipsis>
                    {e.detail}
                  </Typography.Text>
                )}
              </div>
            )
          }
          if (e.type === 'tool_result') {
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, paddingLeft: 20 }}>
                {e.isError ? (
                  <CloseCircleFilled style={{ color: '#ff4d4f', marginTop: 4 }} />
                ) : (
                  <CheckCircleFilled style={{ color: '#52c41a', marginTop: 4 }} />
                )}
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {e.result.length > 160 ? `${e.result.slice(0, 160)}…` : e.result}
                </Typography.Text>
              </div>
            )
          }
          if (e.type === 'assistant_text') {
            return (
              <Typography.Text key={i} italic type="secondary" style={{ fontSize: 12 }}>
                {e.text.length > 200 ? `${e.text.slice(0, 200)}…` : e.text}
              </Typography.Text>
            )
          }
          if (e.type === 'error') {
            return (
              <Tag key={i} color="red">
                {e.message}
              </Tag>
            )
          }
          return null
        })}
        {running && events.length === 0 && (
          <Space>
            <Spin size="small" />
            <Typography.Text type="secondary">思考中…</Typography.Text>
          </Space>
        )}
      </Space>
    </Card>
  )
}
