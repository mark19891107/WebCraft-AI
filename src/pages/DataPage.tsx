import { Layout, Typography, Empty } from 'antd'
import AppHeader from '../components/AppHeader'

const { Content } = Layout

export default function DataPage() {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <AppHeader />
      <Content style={{ padding: 16, maxWidth: 960, margin: '0 auto', width: '100%' }}>
        <Typography.Title level={3}>資料來源管理</Typography.Title>
        <Empty description="檔案上傳與管理即將推出（S6）" />
      </Content>
    </Layout>
  )
}
