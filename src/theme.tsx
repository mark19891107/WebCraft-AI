import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react'
import { ConfigProvider, theme as antdTheme } from 'antd'

export type ThemeMode = 'light' | 'dark'

const KEY = 'webcraft_theme'

interface ThemeContextValue {
  mode: ThemeMode
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue>({ mode: 'dark', toggle: () => {} })

export const useThemeMode = () => useContext(ThemeContext)

// 把目前主題色套到 <body>，避免路由切換/載入時的背景閃白
function BodyStyle() {
  const { token } = antdTheme.useToken()
  useEffect(() => {
    document.body.style.backgroundColor = token.colorBgLayout
    document.body.style.color = token.colorText
  }, [token])
  return null
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(KEY)
    return saved === 'light' || saved === 'dark' ? saved : 'dark'
  })

  const toggle = useCallback(() => {
    setMode((m) => {
      const next: ThemeMode = m === 'dark' ? 'light' : 'dark'
      localStorage.setItem(KEY, next)
      return next
    })
  }, [])

  const value = useMemo(() => ({ mode, toggle }), [mode, toggle])

  return (
    <ThemeContext.Provider value={value}>
      <ConfigProvider
        theme={{
          algorithm: mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
          cssVar: true,
        }}
      >
        <BodyStyle />
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  )
}
