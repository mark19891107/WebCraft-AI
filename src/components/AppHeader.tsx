import { useState } from 'react'
import { Layout, Typography, Button, Drawer, Grid, Space } from 'antd'
import {
  ThunderboltOutlined,
  AppstoreOutlined,
  DatabaseOutlined,
  SettingOutlined,
  MenuOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'

const { Header } = Layout
const { useBreakpoint } = Grid

interface NavItem {
  key: string
  label: string
  icon: React.ReactNode
}

const NAV: NavItem[] = [
  { key: '/', label: '工具庫', icon: <AppstoreOutlined /> },
  { key: '/data', label: '資料來源', icon: <DatabaseOutlined /> },
  { key: '/settings', label: '設定', icon: <SettingOutlined /> },
]

function isActive(pathname: string, key: string): boolean {
  return key === '/' ? pathname === '/' : pathname.startsWith(key)
}

export default function AppHeader() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const screens = useBreakpoint()
  const [drawerOpen, setDrawerOpen] = useState(false)

  // screens.md 為 undefined 時（首次渲染）視為桌機，避免閃動
  const isMobile = screens.md === false

  function go(key: string) {
    navigate(key)
    setDrawerOpen(false)
  }

  return (
    <Header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        background: '#141414',
        borderBottom: '1px solid #303030',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      <Typography.Title
        level={4}
        style={{ margin: 0, color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}
        onClick={() => go('/')}
      >
        <ThunderboltOutlined style={{ marginRight: 8 }} />
        WebCraft AI
      </Typography.Title>

      {isMobile ? (
        <>
          <Button
            type="text"
            aria-label="開啟選單"
            icon={<MenuOutlined style={{ color: '#fff', fontSize: 18 }} />}
            onClick={() => setDrawerOpen(true)}
          />
          <Drawer
            title="WebCraft AI"
            placement="right"
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            width={240}
            styles={{ body: { padding: 8 } }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              {NAV.map((item) => (
                <Button
                  key={item.key}
                  block
                  size="large"
                  style={{ textAlign: 'left', justifyContent: 'flex-start' }}
                  type={isActive(pathname, item.key) ? 'primary' : 'text'}
                  icon={item.icon}
                  onClick={() => go(item.key)}
                >
                  {item.label}
                </Button>
              ))}
            </Space>
          </Drawer>
        </>
      ) : (
        <Space>
          {NAV.map((item) => (
            <Button
              key={item.key}
              type={isActive(pathname, item.key) ? 'primary' : 'text'}
              icon={item.icon}
              onClick={() => go(item.key)}
            >
              {item.label}
            </Button>
          ))}
        </Space>
      )}
    </Header>
  )
}
