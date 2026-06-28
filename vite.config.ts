import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    // antd 為單一龐大的 vendor 塊（獨立、可長期快取）。
    // 路由已用 React.lazy 拆分，首頁不會載入 markdown/highlight。
    // 不手動拆 react/antd/icons：拆開會破壞跨 chunk 初始化順序而出錯。
    chunkSizeWarningLimit: 1500,
  },
})
