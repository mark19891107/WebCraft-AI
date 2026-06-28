import { useEffect, useState } from 'react'
import { Modal, Typography, Checkbox, Empty, Divider, Input, Button, List, Space, Tag, message } from 'antd'
import { DeleteOutlined, PlusOutlined, EditOutlined, CloseOutlined } from '@ant-design/icons'
import { DataSource, MCPServer } from '../types'
import { listFiles, isOPFSSupported, OPFSFileInfo } from '../services/opfs'

interface Props {
  open: boolean
  dataSources: DataSource[]
  mcpServers: MCPServer[]
  onClose: () => void
  onChange: (next: DataSource[]) => void
}

interface HeaderRow {
  k: string
  v: string
}

export default function DataSourceBinder({ open, dataSources, mcpServers, onClose, onChange }: Props) {
  const [files, setFiles] = useState<OPFSFileInfo[]>([])
  const [apiName, setApiName] = useState('')
  const [apiUrl, setApiUrl] = useState('')
  const [apiHeaders, setApiHeaders] = useState<HeaderRow[]>([])
  const [editingApi, setEditingApi] = useState<string | null>(null)

  useEffect(() => {
    if (open && isOPFSSupported()) listFiles('/data').then(setFiles)
  }, [open])

  const boundFileNames = new Set(dataSources.filter((d) => d.type === 'file').map((d) => d.name))
  const apiSources = dataSources.filter((d): d is Extract<DataSource, { type: 'api' }> => d.type === 'api')
  const boundMcpRefs = new Set(dataSources.filter((d) => d.type === 'mcp').map((d) => d.serverRef))

  function toggleMcp(server: MCPServer, checked: boolean) {
    const others = dataSources.filter((d) => !(d.type === 'mcp' && d.serverRef === server.id))
    onChange(checked ? [...others, { type: 'mcp', name: server.name, serverRef: server.id }] : others)
  }

  function toggleFile(info: OPFSFileInfo, checked: boolean) {
    const others = dataSources.filter((d) => !(d.type === 'file' && d.name === info.name))
    onChange(checked ? [...others, { type: 'file', name: info.name, opfsPath: info.path }] : others)
  }

  function resetApiDraft() {
    setApiName('')
    setApiUrl('')
    setApiHeaders([])
    setEditingApi(null)
  }

  function saveApi() {
    const name = apiName.trim()
    const url = apiUrl.trim()
    if (!name || !url) {
      message.warning('請填入名稱與 URL')
      return
    }
    if (name !== editingApi && dataSources.some((d) => d.name === name)) {
      message.warning('已有同名來源')
      return
    }
    const headers: Record<string, string> = {}
    apiHeaders.forEach((h) => {
      if (h.k.trim()) headers[h.k.trim()] = h.v
    })
    const others = dataSources.filter((d) => !(d.type === 'api' && d.name === editingApi))
    onChange([...others, { type: 'api', name, url, headers }])
    resetApiDraft()
  }

  function editApi(d: Extract<DataSource, { type: 'api' }>) {
    setEditingApi(d.name)
    setApiName(d.name)
    setApiUrl(d.url)
    setApiHeaders(Object.entries(d.headers ?? {}).map(([k, v]) => ({ k, v })))
  }

  function removeSource(name: string) {
    if (editingApi === name) resetApiDraft()
    onChange(dataSources.filter((d) => d.name !== name))
  }

  return (
    <Modal title="綁定資料來源" open={open} onCancel={onClose} onOk={onClose} okText="完成" cancelText="關閉">
      <Typography.Title level={5}>已上傳的檔案（OPFS）</Typography.Title>
      {files.length === 0 ? (
        <Empty description="尚無檔案，請先到「資料來源」頁上傳" />
      ) : (
        <Space direction="vertical">
          {files.map((f) => (
            <Checkbox
              key={f.path}
              checked={boundFileNames.has(f.name)}
              onChange={(e) => toggleFile(f, e.target.checked)}
            >
              {f.name}
            </Checkbox>
          ))}
        </Space>
      )}

      <Divider />

      <Typography.Title level={5}>API 來源</Typography.Title>
      {apiSources.length > 0 && (
        <List
          size="small"
          dataSource={apiSources}
          renderItem={(d) => (
            <List.Item
              actions={[
                <Button key="edit" type="text" size="small" icon={<EditOutlined />} onClick={() => editApi(d)} />,
                <Button
                  key="del"
                  type="text"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={() => removeSource(d.name)}
                />,
              ]}
            >
              <Tag color="green">{d.name}</Tag>
              <Typography.Text type="secondary" ellipsis style={{ maxWidth: 200 }}>
                {d.url}
              </Typography.Text>
              {Object.keys(d.headers ?? {}).length > 0 && <Tag>{Object.keys(d.headers).length} headers</Tag>}
            </List.Item>
          )}
        />
      )}

      <Space direction="vertical" style={{ width: '100%', marginTop: 8 }}>
        <Input placeholder="名稱（例如：新聞）" value={apiName} onChange={(e) => setApiName(e.target.value)} />
        <Input placeholder="https://api.example.com/..." value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} />
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          請求標頭（Headers，可選，例如 Authorization）
        </Typography.Text>
        {apiHeaders.map((h, i) => (
          <Space.Compact key={i} style={{ width: '100%' }}>
            <Input
              placeholder="Header 名稱"
              value={h.k}
              onChange={(e) =>
                setApiHeaders((prev) => prev.map((x, j) => (j === i ? { ...x, k: e.target.value } : x)))
              }
            />
            <Input
              placeholder="值"
              value={h.v}
              onChange={(e) =>
                setApiHeaders((prev) => prev.map((x, j) => (j === i ? { ...x, v: e.target.value } : x)))
              }
            />
            <Button
              icon={<CloseOutlined />}
              onClick={() => setApiHeaders((prev) => prev.filter((_, j) => j !== i))}
            />
          </Space.Compact>
        ))}
        <Space>
          <Button size="small" icon={<PlusOutlined />} onClick={() => setApiHeaders((prev) => [...prev, { k: '', v: '' }])}>
            加一列標頭
          </Button>
          <Button type="primary" onClick={saveApi}>
            {editingApi ? '儲存修改' : '新增 API 來源'}
          </Button>
          {editingApi && <Button onClick={resetApiDraft}>取消</Button>}
        </Space>
      </Space>

      <Divider />

      <Typography.Title level={5}>MCP Servers</Typography.Title>
      {mcpServers.length === 0 ? (
        <Empty description="尚未設定 MCP Server，請到「設定」頁新增" />
      ) : (
        <Space direction="vertical">
          {mcpServers.map((s) => (
            <Checkbox
              key={s.id}
              checked={boundMcpRefs.has(s.id)}
              onChange={(e) => toggleMcp(s, e.target.checked)}
            >
              {s.name}
            </Checkbox>
          ))}
        </Space>
      )}
    </Modal>
  )
}
