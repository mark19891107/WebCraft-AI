import { HashRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import CreatePage from './pages/CreatePage'
import ToolPage from './pages/ToolPage'
import DataPage from './pages/DataPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/create" element={<CreatePage />} />
        <Route path="/create/:id" element={<CreatePage />} />
        <Route path="/tool/:id" element={<ToolPage />} />
        <Route path="/data" element={<DataPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </HashRouter>
  )
}
