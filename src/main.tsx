import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider } from './theme'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)

// 註冊 service worker（離線可用 / 可安裝）；相對路徑相容 GitHub Pages 子路徑，失敗不影響 App
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {})
  })
}
