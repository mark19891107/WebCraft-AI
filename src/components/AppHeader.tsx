import { useState } from 'react'
import { Layout, Typography, Button, Drawer, Grid, Space, Switch, theme } from 'antd'
import {
  ThunderboltOutlined,
  AppstoreOutlined,
  DatabaseOutlined,
  SettingOutlined,
  MenuOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useThemeMode } from '../theme'

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
  const { token } = theme.useToken()
  const { mode, toggle } = useThemeMode()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const isMobile = screens.md === false

  function go(key: string) {
    navigate(key)
    setDrawerOpen(false)
  }

  const themeSwitch = (
    <Switch
      checked={mode === 'dark'}
      onChange={toggle}
      checkedChildren="🌙"
      unCheckedChildren="☀️"
      aria-label="切換深色/淺色模式"
    />
  )

  return (
    <Header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        background: token.colorBgContainer,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      <Typography.Title
        level={4}
        style={{ margin: 0, color: token.colorText, cursor: 'pointer', whiteSpace: 'nowrap' }}
        onClick={() => go('/')}
      >
        <ThunderboltOutlined style={{ marginRight: 8, color: token.colorPrimary }} />
        WebCraft AI
      </Typography.Title>

      {isMobile ? (
        <Space>
          {themeSwitch}
          <Button
            type="text"
            aria-label="開啟選單"
            icon={<MenuOutlined style={{ fontSize: 18 }} />}
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
        </Space>
      ) : (
        <Space>
          {themeSwitch}
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
