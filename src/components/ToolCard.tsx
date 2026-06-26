import { Card, Typography, Space, Dropdown, Button, Popconfirm } from 'antd'
import {
  EllipsisOutlined,
  EditOutlined,
  ExportOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { ToolDefinition } from '../types'
import DataSourceBadge, { LLMBadge } from './DataSourceBadge'

interface Props {
  tool: ToolDefinition
  onDelete: (id: string) => void
  onExport?: (tool: ToolDefinition) => void
}

export default function ToolCard({ tool, onDelete, onExport }: Props) {
  const navigate = useNavigate()

  const menuItems = [
    { key: 'open', label: '開啟', icon: <PlayCircleOutlined /> },
    { key: 'edit', label: '編輯', icon: <EditOutlined /> },
    ...(onExport ? [{ key: 'export', label: '匯出', icon: <ExportOutlined /> }] : []),
  ]

  function handleMenu({ key, domEvent }: { key: string; domEvent: React.SyntheticEvent }) {
    domEvent.stopPropagation()
    if (key === 'open') navigate(`/tool/${tool.id}`)
    if (key === 'edit') navigate(`/create/${tool.id}`)
    if (key === 'export') onExport?.(tool)
  }

  return (
    <Card
      hoverable
      onClick={() => navigate(`/tool/${tool.id}`)}
      title={tool.name}
      extra={
        <Dropdown
          menu={{ items: menuItems, onClick: handleMenu }}
          trigger={['click']}
          dropdownRender={(menu) => (
            <div onClick={(e) => e.stopPropagation()}>
              {menu}
              <div style={{ padding: 4 }}>
                <Popconfirm
                  title="確定刪除這個工具？"
                  okText="刪除"
                  okButtonProps={{ danger: true }}
                  cancelText="取消"
                  onConfirm={() => onDelete(tool.id)}
                >
                  <Button block danger size="small" icon={<DeleteOutlined />}>
                    刪除
                  </Button>
                </Popconfirm>
              </div>
            </div>
          )}
        >
          <Button type="text" icon={<EllipsisOutlined />} onClick={(e) => e.stopPropagation()} />
        </Dropdown>
      }
    >
      <Typography.Paragraph ellipsis={{ rows: 2 }} type="secondary" style={{ minHeight: 44 }}>
        {tool.description || '無描述'}
      </Typography.Paragraph>
      <Space wrap>
        <LLMBadge />
        {tool.dataSources.map((ds, i) => (
          <DataSourceBadge key={i} source={ds} />
        ))}
      </Space>
    </Card>
  )
}
