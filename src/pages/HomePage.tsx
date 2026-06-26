import { Layout, Typography, Card, Space, Tag } from 'antd'
import { ThunderboltOutlined } from '@ant-design/icons'

const { Header, Content } = Layout

export default function HomePage() {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <ThunderboltOutlined style={{ color: '#fff', fontSize: 20 }} />
        <Typography.Title level={4} style={{ margin: 0, color: '#fff' }}>
          WebCraft AI
        </Typography.Title>
      </Header>
      <Content style={{ padding: 24, maxWidth: 800, margin: '0 auto', width: '100%' }}>
        <Typography.Title level={3}>我的工具庫</Typography.Title>
        <Card>
          <Space direction="vertical">
            <Typography.Text>
              🚧 專案骨架已建立並成功部署到 GitHub Pages。
            </Typography.Text>
            <Typography.Text type="secondary">
              接下來會依照實作計畫逐步加入各項功能。
            </Typography.Text>
            <Space wrap>
              <Tag color="blue">React 18</Tag>
              <Tag color="green">Vite</Tag>
              <Tag color="purple">Ant Design</Tag>
              <Tag color="orange">Hash Router</Tag>
            </Space>
          </Space>
        </Card>
      </Content>
    </Layout>
  )
}
