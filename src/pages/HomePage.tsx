import { Layout, Row, Col, Button, Empty, Typography, Upload, message } from 'antd'
import { PlusOutlined, ImportOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import AppHeader from '../components/AppHeader'
import ToolCard from '../components/ToolCard'
import { useTools } from '../hooks/useTools'
import { exportTool, downloadToolJson, importToolJson } from '../services/exportImport'
import { ToolDefinition } from '../types'

const { Content } = Layout

export default function HomePage() {
  const navigate = useNavigate()
  const { tools, remove, save } = useTools()

  async function handleExport(tool: ToolDefinition) {
    const exported = await exportTool(tool)
    exported.warnings?.forEach((w) => message.warning(w))
    downloadToolJson(exported)
  }

  async function handleImport(file: File) {
    try {
      const tool = await importToolJson(file)
      tool.id = uuidv4() // 重新指定 id，避免覆蓋
      save(tool)
      message.success(`已匯入工具：${tool.name}`)
    } catch {
      message.error('匯入失敗，請確認檔案格式正確')
    }
    return false
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <AppHeader />
      <Content style={{ padding: 16, maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
            marginBottom: 16,
            flexWrap: 'wrap',
          }}
        >
          <Typography.Title level={3} style={{ margin: 0 }}>
            我的工具庫
          </Typography.Title>
          <div style={{ display: 'flex', gap: 8 }}>
            <Upload accept=".json" showUploadList={false} beforeUpload={handleImport}>
              <Button icon={<ImportOutlined />}>匯入</Button>
            </Upload>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/create')}>
              新增工具
            </Button>
          </div>
        </div>

        {tools.length === 0 ? (
          <Empty description="還沒有工具，點擊「新增工具」開始建立">
            <Button type="primary" onClick={() => navigate('/create')}>
              新增第一個工具
            </Button>
          </Empty>
        ) : (
          <Row gutter={[16, 16]}>
            {tools.map((tool) => (
              <Col key={tool.id} xs={24} sm={12} md={8} lg={6}>
                <ToolCard tool={tool} onDelete={remove} onExport={handleExport} />
              </Col>
            ))}
          </Row>
        )}
      </Content>
    </Layout>
  )
}
