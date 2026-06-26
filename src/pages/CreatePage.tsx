import { Layout, Typography, Empty } from 'antd'
import AppHeader from '../components/AppHeader'

const { Content } = Layout

export default function CreatePage() {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <AppHeader />
      <Content style={{ padding: 16, maxWidth: 960, margin: '0 auto', width: '100%' }}>
        <Typography.Title level={3}>建立工具</Typography.Title>
        <Empty description="對話式生成與預覽即將推出（S4）" />
      </Content>
    </Layout>
  )
}
