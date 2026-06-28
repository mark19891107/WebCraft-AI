import {
  Layout,
  Form,
  Input,
  Button,
  Space,
  Typography,
  Alert,
  message,
  Divider,
  Table,
  Modal,
  Select,
  Popconfirm,
} from 'antd'
import { ApiOutlined, SaveOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { Progress, List } from 'antd'
import AppHeader from '../components/AppHeader'
import { useSettings } from '../hooks/useSettings'
import { testConnection } from '../services/llm'
import { connectMCP } from '../services/mcpClient'
import { getStorageUsage, formatBytes } from '../services/storageUsage'
import { Settings, MCPServer } from '../types'

// localStorage 多數瀏覽器約 5MB
const STORAGE_LIMIT = 5 * 1024 * 1024

const { Content } = Layout

export default function SettingsPage() {
  const { settings, update } = useSettings()
  const [llmForm] = Form.useForm<Settings['llm']>()
  const [mcpForm] = Form.useForm<Omit<MCPServer, 'id'>>()
  const [testing, setTesting] = useState(false)
  const [mcpModalOpen, setMcpModalOpen] = useState(false)
  const [editingMcp, setEditingMcp] = useState<MCPServer | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [usage, setUsage] = useState(() => getStorageUsage())

  function handleSaveLLM(values: Settings['llm']) {
    update({ ...settings, llm: values })
    message.success('LLM 設定已儲存')
  }

  async function handleTestLLM() {
    const values = llmForm.getFieldsValue()
    if (!values.endpoint) {
      message.warning('請先填入 Endpoint URL')
      return
    }
    setTesting(true)
    const ok = await testConnection(values)
    setTesting(false)
    if (ok) message.success('連線成功')
    else message.error('連線失敗，請確認 Endpoint 與 API Key')
  }

  function openAddMcp() {
    setEditingMcp(null)
    mcpForm.resetFields()
    setMcpModalOpen(true)
  }

  function openEditMcp(server: MCPServer) {
    setEditingMcp(server)
    mcpForm.setFieldsValue(server)
    setMcpModalOpen(true)
  }

  async function handleSaveMcp(values: Omit<MCPServer, 'id'>) {
    const server: MCPServer = { ...values, id: editingMcp?.id ?? uuidv4() }
    setConnecting(true)
    try {
      await connectMCP(server)
      message.success(`MCP "${server.name}" 連線成功`)
    } catch (err) {
      message.warning(`已儲存，但連線測試失敗：${err}`)
    } finally {
      setConnecting(false)
    }
    const others = settings.mcpServers.filter((s) => s.id !== server.id)
    update({ ...settings, mcpServers: [...others, server] })
    setMcpModalOpen(false)
  }

  function deleteMcp(id: string) {
    update({ ...settings, mcpServers: settings.mcpServers.filter((s) => s.id !== id) })
  }

  const mcpColumns = [
    { title: '名稱', dataIndex: 'name' },
    { title: 'URL', dataIndex: 'url', ellipsis: true },
    { title: 'Transport', dataIndex: 'transport', width: 140 },
    {
      title: '操作',
      width: 120,
      render: (_: unknown, record: MCPServer) => (
        <Space>
          <Button size="small" onClick={() => openEditMcp(record)}>
            編輯
          </Button>
          <Popconfirm title="刪除此 MCP Server？" okText="刪除" cancelText="取消" onConfirm={() => deleteMcp(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <AppHeader />
      <Content style={{ padding: 16, maxWidth: 720, margin: '0 auto', width: '100%' }}>
        <Typography.Title level={3}>設定</Typography.Title>

        <Typography.Title level={4}>LLM 設定</Typography.Title>
        <Alert
          style={{ marginBottom: 16 }}
          type="warning"
          showIcon
          message="API Key 以明文儲存於此瀏覽器的 localStorage，請勿在共用裝置上使用。"
        />
        <Form form={llmForm} initialValues={settings.llm} onFinish={handleSaveLLM} layout="vertical">
          <Form.Item name="endpoint" label="Endpoint URL" rules={[{ required: true, message: '請輸入 Endpoint' }]}>
            <Input placeholder="https://api.openai.com/v1" />
          </Form.Item>
          <Form.Item name="apiKey" label="API Key" rules={[{ required: true, message: '請輸入 API Key' }]}>
            <Input.Password placeholder="sk-..." autoComplete="off" />
          </Form.Item>
          <Form.Item name="model" label="Model" rules={[{ required: true, message: '請輸入 Model' }]}>
            <Input placeholder="gpt-4o" />
          </Form.Item>
          <Space wrap>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
              儲存
            </Button>
            <Button icon={<ApiOutlined />} loading={testing} onClick={handleTestLLM}>
              測試連線
            </Button>
          </Space>
        </Form>

        <Divider />

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <Typography.Title level={4} style={{ margin: 0 }}>
            MCP Servers
          </Typography.Title>
          <Button icon={<PlusOutlined />} onClick={openAddMcp}>
            新增
          </Button>
        </div>
        <Alert
          style={{ marginBottom: 12 }}
          type="info"
          showIcon
          message="MCP Server 需允許瀏覽器跨來源（CORS）請求，否則無法在前端直接連線。"
        />
        <Table
          dataSource={settings.mcpServers}
          columns={mcpColumns}
          rowKey="id"
          pagination={false}
          size="small"
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: '尚未設定 MCP Server' }}
        />

        <Modal
          title={editingMcp ? '編輯 MCP Server' : '新增 MCP Server'}
          open={mcpModalOpen}
          onCancel={() => setMcpModalOpen(false)}
          footer={null}
        >
          <Form form={mcpForm} onFinish={handleSaveMcp} layout="vertical" initialValues={{ transport: 'streamable-http' }}>
            <Form.Item name="name" label="名稱" rules={[{ required: true }]}>
              <Input placeholder="my-server" />
            </Form.Item>
            <Form.Item name="url" label="URL" rules={[{ required: true }]}>
              <Input placeholder="https://localhost:3000/mcp" />
            </Form.Item>
            <Form.Item name="transport" label="Transport" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: 'streamable-http', label: 'Streamable HTTP' },
                  { value: 'sse', label: 'SSE' },
                ]}
              />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={connecting}>
              儲存並測試連線
            </Button>
          </Form>
        </Modal>

        <Divider />

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <Typography.Title level={4} style={{ margin: 0 }}>
            儲存空間
          </Typography.Title>
          <Button size="small" onClick={() => setUsage(getStorageUsage())}>
            重新整理
          </Button>
        </div>
        <Progress
          percent={Math.min(100, Math.round((usage.totalBytes / STORAGE_LIMIT) * 100))}
          format={() => `${formatBytes(usage.totalBytes)} / ~5 MB`}
          status={usage.totalBytes > STORAGE_LIMIT * 0.9 ? 'exception' : 'normal'}
        />
        <List
          size="small"
          dataSource={usage.items}
          locale={{ emptyText: '無資料' }}
          renderItem={(item) => (
            <List.Item>
              <Typography.Text>{item.label}</Typography.Text>
              <Typography.Text type="secondary">{formatBytes(item.bytes)}</Typography.Text>
            </List.Item>
          )}
        />
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          版本歷史會保存每個版本的完整程式碼，數量多時較佔空間，可在編輯工具時用「精簡版本」清理。
        </Typography.Text>
      </Content>
    </Layout>
  )
}
