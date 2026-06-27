import { HashRouter, Routes, Route } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { Spin } from 'antd'

const HomePage = lazy(() => import('./pages/HomePage'))
const CreatePage = lazy(() => import('./pages/CreatePage'))
const ToolPage = lazy(() => import('./pages/ToolPage'))
const DataPage = lazy(() => import('./pages/DataPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))

function PageFallback() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}>
      <Spin size="large" />
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/create" element={<CreatePage />} />
          <Route path="/create/:id" element={<CreatePage />} />
          <Route path="/tool/:id" element={<ToolPage />} />
          <Route path="/data" element={<DataPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Suspense>
    </HashRouter>
  )
}
