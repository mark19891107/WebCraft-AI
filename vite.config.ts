import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    // antd 為單一龐大的 vendor 塊（獨立、可長期快取），故放寬警告門檻
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('highlight.js')) return 'highlight'
          if (id.includes('@ant-design/icons')) return 'icons'
          if (
            id.includes('react-markdown') ||
            id.includes('remark') ||
            id.includes('micromark') ||
            id.includes('mdast') ||
            id.includes('hast') ||
            id.includes('unist') ||
            id.includes('vfile') ||
            id.includes('property-information') ||
            id.includes('decode-named-character-reference') ||
            id.includes('character-entities') ||
            id.includes('comma-separated-tokens') ||
            id.includes('space-separated-tokens') ||
            id.includes('trim-lines') ||
            id.includes('zwitch') ||
            id.includes('html-url-attributes')
          ) {
            return 'markdown'
          }
          if (id.includes('antd') || id.includes('@ant-design') || id.includes('rc-')) return 'antd'
          if (id.includes('react') || id.includes('scheduler')) return 'react'
          return 'vendor'
        },
      },
    },
  },
})
