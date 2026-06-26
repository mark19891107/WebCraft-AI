import { Layout, Typography, Card, Space, Tag } from 'antd'
import AppHeader from '../components/AppHeader'

const { Content } = Layout

export default function HomePage() {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <AppHeader />
      <Content style={{ padding: 16, maxWidth: 960, margin: '0 auto', width: '100%' }}>
        <Typography.Title level={3}>我的工具庫</Typography.Title>
        <Card>
          <Space direction="vertical">
            <Typography.Text>
              🚧 App 外殼與導覽已完成（行動優先）。
            </Typography.Text>
            <Typography.Text type="secondary">
              桌機顯示橫向導覽，手機改為漢堡選單 + 側欄。接下來會依 Roadmap 逐步加入各項功能。
            </Typography.Text>
            <Space wrap>
              <Tag color="blue">React 18</Tag>
              <Tag color="green">Vite</Tag>
              <Tag color="purple">Ant Design</Tag>
              <Tag color="cyan">RWD</Tag>
            </Space>
          </Space>
        </Card>
      </Content>
    </Layout>
  )
}
