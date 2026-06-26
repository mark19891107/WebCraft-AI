import { Layout, Row, Col, Button, Empty, Typography } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import AppHeader from '../components/AppHeader'
import ToolCard from '../components/ToolCard'
import { useTools } from '../hooks/useTools'

const { Content } = Layout

export default function HomePage() {
  const navigate = useNavigate()
  const { tools, remove } = useTools()

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
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/create')}>
            新增工具
          </Button>
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
                <ToolCard tool={tool} onDelete={remove} />
              </Col>
            ))}
          </Row>
        )}
      </Content>
    </Layout>
  )
}
