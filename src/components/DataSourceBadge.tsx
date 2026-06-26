import { Tag } from 'antd'
import { FileTextOutlined, ApiOutlined, CloudServerOutlined, RobotOutlined } from '@ant-design/icons'
import { DataSource } from '../types'

const CONFIG = {
  file: { color: 'blue', icon: <FileTextOutlined />, label: 'CSV/JSON' },
  api: { color: 'green', icon: <ApiOutlined />, label: 'API' },
  mcp: { color: 'purple', icon: <CloudServerOutlined />, label: 'MCP' },
} as const

export default function DataSourceBadge({ source }: { source: DataSource }) {
  const cfg = CONFIG[source.type]
  return (
    <Tag color={cfg.color} icon={cfg.icon}>
      {source.name || cfg.label}
    </Tag>
  )
}

export function LLMBadge() {
  return (
    <Tag color="orange" icon={<RobotOutlined />}>
      LLM
    </Tag>
  )
}
