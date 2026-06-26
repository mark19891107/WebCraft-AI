import { Layout, Typography, Empty } from 'antd'
import AppHeader from '../components/AppHeader'

const { Content } = Layout

export default function SettingsPage() {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <AppHeader />
      <Content style={{ padding: 16, maxWidth: 720, margin: '0 auto', width: '100%' }}>
        <Typography.Title level={3}>設定</Typography.Title>
        <Empty description="LLM 與 MCP 設定即將推出（S2 / S9）" />
      </Content>
    </Layout>
  )
}
