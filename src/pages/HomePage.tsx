import { useState } from 'react'
import { Layout, Row, Col, Button, Empty, Typography, Upload, message, Input, Modal, List } from 'antd'
import { PlusOutlined, ImportOutlined, AppstoreAddOutlined, SearchOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import AppHeader from '../components/AppHeader'
import ToolCard from '../components/ToolCard'
import { useTools } from '../hooks/useTools'
import { exportTool, downloadToolJson, importToolJson } from '../services/exportImport'
import { TEMPLATES, ToolTemplate } from '../services/templates'
import { ToolDefinition } from '../types'

const { Content } = Layout

function toolFromTemplate(t: ToolTemplate): ToolDefinition {
  const now = new Date().toISOString()
  const versionId = uuidv4()
  return {
    id: uuidv4(),
    name: t.name,
    description: t.description,
    createdAt: now,
    updatedAt: now,
    currentVersionId: versionId,
    versions: [{ versionId, parentVersionId: null, createdAt: now, code: t.code, conversation: [] }],
    dataSources: [],
    conversation: [],
  }
}

export default function HomePage() {
  const navigate = useNavigate()
  const { tools, remove, save } = useTools()
  const [query, setQuery] = useState('')
  const [tplOpen, setTplOpen] = useState(false)

  const filtered = tools.filter((t) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
  })

  async function handleExport(tool: ToolDefinition) {
    const exported = await exportTool(tool)
    exported.warnings?.forEach((w) => message.warning(w))
    downloadToolJson(exported)
  }

  async function handleImport(file: File) {
    try {
      const tool = await importToolJson(file)
      tool.id = uuidv4()
      save(tool)
      message.success(`已匯入工具：${tool.name}`)
    } catch {
      message.error('匯入失敗，請確認檔案格式正確')
    }
    return false
  }

  function handleDuplicate(tool: ToolDefinition) {
    const copy: ToolDefinition = {
      ...tool,
      id: uuidv4(),
      name: `${tool.name}（複本）`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    save(copy)
    message.success('已複製工具')
  }

  function handleUseTemplate(t: ToolTemplate) {
    const tool = toolFromTemplate(t)
    save(tool)
    setTplOpen(false)
    navigate(`/tool/${tool.id}`)
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <AppHeader />
      <Content style={{ padding: 16, maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
            marginBottom: 16,
            flexWrap: 'wrap',
          }}
        >
          <Typography.Title level={3} style={{ margin: 0 }}>
            我的工具庫
          </Typography.Title>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="搜尋工具"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ width: 180 }}
            />
            <Button icon={<AppstoreAddOutlined />} onClick={() => setTplOpen(true)}>
              範本
            </Button>
            <Upload accept=".json" showUploadList={false} beforeUpload={handleImport}>
              <Button icon={<ImportOutlined />}>匯入</Button>
            </Upload>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/create')}>
              新增工具
            </Button>
          </div>
        </div>

        {tools.length === 0 ? (
          <Empty description="還沒有工具，點擊「新增工具」開始建立，或從「範本」快速開始">
            <Button type="primary" onClick={() => navigate('/create')}>
              新增第一個工具
            </Button>
          </Empty>
        ) : filtered.length === 0 ? (
          <Empty description={`找不到符合「${query}」的工具`} />
        ) : (
          <Row gutter={[16, 16]}>
            {filtered.map((tool) => (
              <Col key={tool.id} xs={24} sm={12} md={8} lg={6}>
                <ToolCard tool={tool} onDelete={remove} onExport={handleExport} onDuplicate={handleDuplicate} />
              </Col>
            ))}
          </Row>
        )}

        <Modal title="從範本新增" open={tplOpen} onCancel={() => setTplOpen(false)} footer={null}>
          <List
            dataSource={TEMPLATES}
            renderItem={(t) => (
              <List.Item
                actions={[
                  <Button key="use" type="primary" onClick={() => handleUseTemplate(t)}>
                    使用
                  </Button>,
                ]}
              >
                <List.Item.Meta title={t.name} description={t.description} />
              </List.Item>
            )}
          />
        </Modal>
      </Content>
    </Layout>
  )
}
