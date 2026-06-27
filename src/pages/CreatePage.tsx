import { useState } from 'react'
import { Layout, Button, Input, Space, message, Modal, Form, Typography, Grid, Tabs, Tag, Badge } from 'antd'
import { SaveOutlined, ArrowLeftOutlined, DatabaseOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import AppHeader from '../components/AppHeader'
import ChatPanel from '../components/ChatPanel'
import PreviewPanel from '../components/PreviewPanel'
import DataSourceBinder from '../components/DataSourceBinder'
import { useTools } from '../hooks/useTools'
import { useSettings } from '../hooks/useSettings'
import { useLLMStream } from '../hooks/useLLMStream'
import { parsePatches, applyPatches, extractExplanation, extractFullHtml } from '../services/patch'
import {
  buildFirstTurnSystemPrompt,
  buildPatchSystemPrompt,
  buildBrainstormSystemPrompt,
  READY_MARKER,
} from '../services/systemPrompt'
import { summarizeBoundData } from '../services/dataSource'
import { ToolDefinition, ToolVersion, Message, DataSource } from '../types'

const { useBreakpoint } = Grid

function newTool(name: string): ToolDefinition {
  const now = new Date().toISOString()
  return {
    id: uuidv4(),
    name,
    description: '',
    createdAt: now,
    updatedAt: now,
    currentVersionId: '',
    versions: [],
    dataSources: [],
    conversation: [],
  }
}

export default function CreatePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { getTool, save } = useTools()
  const { settings } = useSettings()
  const { streaming, streamExplanation, streamCode, start, abort } = useLLMStream()
  const screens = useBreakpoint()
  const isMobile = screens.md === false

  const [tool, setTool] = useState<ToolDefinition>(() => (id ? getTool(id) ?? newTool('新工具') : newTool('新工具')))
  const currentVersion = tool.versions.find((v) => v.versionId === tool.currentVersionId)
  const [messages, setMessages] = useState<Message[]>(() => currentVersion?.conversation ?? tool.conversation ?? [])
  const [input, setInput] = useState('')
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [bindOpen, setBindOpen] = useState(false)
  const [previewTab, setPreviewTab] = useState('tool')
  const [mobileTab, setMobileTab] = useState('chat')
  const [generatingCode, setGeneratingCode] = useState(false)
  const [ready, setReady] = useState(false)

  const hasVersions = tool.versions.length > 0

  function llmReady(): boolean {
    if (!settings.llm.endpoint || !settings.llm.apiKey) {
      message.error('請先在設定頁填入 LLM Endpoint 與 API Key')
      return false
    }
    return true
  }

  function persistConversation(conv: Message[], extra?: Partial<ToolDefinition>) {
    const updated = { ...tool, conversation: conv, updatedAt: new Date().toISOString(), ...extra }
    setTool(updated)
    save(updated)
    if (!id) navigate(`/create/${updated.id}`, { replace: true })
  }

  function commitVersion(code: string, conversation: Message[]) {
    const versionId = uuidv4()
    const version: ToolVersion = {
      versionId,
      parentVersionId: tool.currentVersionId || null,
      createdAt: new Date().toISOString(),
      code,
      conversation,
    }
    const updated: ToolDefinition = {
      ...tool,
      updatedAt: new Date().toISOString(),
      currentVersionId: versionId,
      versions: [...tool.versions, version],
      conversation,
    }
    setTool(updated)
    save(updated)
    if (!id) navigate(`/create/${updated.id}`, { replace: true })
  }

  function handleBind(dataSources: DataSource[]) {
    const updated = { ...tool, dataSources, updatedAt: new Date().toISOString() }
    setTool(updated)
    save(updated)
  }

  // 腦力激盪：只聊天問問題、偵測 ready 標記
  async function runBrainstorm(userMsg: Message) {
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput('')
    let full: string
    try {
      full = await start(settings.llm, buildBrainstormSystemPrompt(tool.dataSources), updatedMessages)
    } catch (err) {
      if (String(err).includes('AbortError')) return
      message.error(`LLM 請求失敗：${err}`)
      return
    }
    const isReady = full.includes(READY_MARKER)
    const content = extractExplanation(full).split(READY_MARKER).join('').trim() || '（請繼續補充）'
    const newConversation: Message[] = [...updatedMessages, { role: 'assistant', content }]
    setMessages(newConversation)
    persistConversation(newConversation)
    if (isReady) setReady(true)
  }

  // 首輪生成：依目前對話生成完整 HTML
  async function generate() {
    if (streaming) return
    if (!llmReady()) return
    if (messages.length === 0) {
      message.warning('請先描述你想要的工具')
      return
    }
    const schema = await summarizeBoundData(tool.dataSources)
    const triggerMsg: Message = { role: 'user', content: '請根據以上討論，直接生成這個工具。' }
    const genMessages = [...messages, triggerMsg]
    setMessages(genMessages)
    setGeneratingCode(true)
    setPreviewTab('code')
    setMobileTab('preview')
    let full: string
    try {
      full = await start(settings.llm, buildFirstTurnSystemPrompt(tool.dataSources, schema), genMessages)
    } catch (err) {
      setGeneratingCode(false)
      if (String(err).includes('AbortError')) return
      message.error(`LLM 請求失敗：${err}`)
      return
    }
    setGeneratingCode(false)
    const code = extractFullHtml(full)
    if (!code) {
      message.warning('未能取得程式碼，請重試或補充說明')
      return
    }
    const explanation = extractExplanation(full) || '已生成工具。'
    const newConversation: Message[] = [...genMessages, { role: 'assistant', content: explanation }]
    setMessages(newConversation)
    commitVersion(code, newConversation)
    setReady(false)
    setPreviewTab('tool')
  }

  // 後續增量修改（patch）
  async function editTurn(userMsg: Message) {
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput('')
    const schema = await summarizeBoundData(tool.dataSources)
    setGeneratingCode(true)
    setPreviewTab('code')
    setMobileTab('preview')
    let full: string
    try {
      full = await start(
        settings.llm,
        buildPatchSystemPrompt(currentVersion?.code ?? '', tool.dataSources, schema),
        updatedMessages,
      )
    } catch (err) {
      setGeneratingCode(false)
      if (String(err).includes('AbortError')) return
      message.error(`LLM 請求失敗：${err}`)
      return
    }

    let newCode: string | null
    const patches = parsePatches(full)
    if (patches.length > 0) {
      newCode = applyPatches(currentVersion?.code ?? '', patches)
      if (!newCode) {
        message.warning('Patch 套用失敗，正在要求完整重新生成…')
        try {
          const fallback = await start(
            settings.llm,
            buildFirstTurnSystemPrompt(tool.dataSources, schema),
            updatedMessages,
          )
          newCode = extractFullHtml(fallback)
        } catch {
          setGeneratingCode(false)
          message.error('重新生成失敗')
          return
        }
      }
    } else {
      newCode = extractFullHtml(full)
    }
    setGeneratingCode(false)

    if (!newCode) {
      message.warning('未能從 LLM 回應中取得程式碼，請重試')
      return
    }
    const explanation = extractExplanation(full) || '已更新工具。'
    const newConversation: Message[] = [...updatedMessages, { role: 'assistant', content: explanation }]
    setMessages(newConversation)
    commitVersion(newCode, newConversation)
    setPreviewTab('tool')
  }

  function handleSend() {
    if (!input.trim() || streaming) return
    if (!llmReady()) return
    const userMsg: Message = { role: 'user', content: input }
    if (hasVersions) editTurn(userMsg)
    else runBrainstorm(userMsg)
  }

  function handleVersionSelect(versionId: string) {
    const version = tool.versions.find((v) => v.versionId === versionId)
    if (!version) return
    const updated = { ...tool, currentVersionId: versionId }
    setTool(updated)
    setMessages(version.conversation)
    save(updated)
  }

  function handleVersionDelete(versionId: string) {
    const toDelete = new Set<string>()
    const collect = (vid: string) => {
      toDelete.add(vid)
      tool.versions.filter((v) => v.parentVersionId === vid).forEach((v) => collect(v.versionId))
    }
    collect(versionId)
    const remaining = tool.versions.filter((v) => !toDelete.has(v.versionId))
    const newCurrentId = toDelete.has(tool.currentVersionId)
      ? remaining[remaining.length - 1]?.versionId ?? ''
      : tool.currentVersionId
    const updated = { ...tool, versions: remaining, currentVersionId: newCurrentId }
    setTool(updated)
    save(updated)
    if (newCurrentId !== tool.currentVersionId) {
      setMessages(remaining.find((v) => v.versionId === newCurrentId)?.conversation ?? [])
    }
  }

  function handleVersionLabel(versionId: string, label: string) {
    const updated = {
      ...tool,
      versions: tool.versions.map((v) => (v.versionId === versionId ? { ...v, label } : v)),
    }
    setTool(updated)
    save(updated)
  }

  function handleSaveInfo(values: { name: string; description: string }) {
    const updated = { ...tool, ...values, updatedAt: new Date().toISOString() }
    setTool(updated)
    save(updated)
    setSaveModalOpen(false)
  }

  const chat = (
    <ChatPanel
      messages={messages}
      streaming={streaming}
      streamText={streamExplanation}
      input={input}
      onInputChange={setInput}
      onSend={handleSend}
      onAbort={abort}
      placeholder={hasVersions ? '描述要修改的地方…' : '描述你想要的工具，我會先問幾個問題…'}
    />
  )

  const preview = (
    <PreviewPanel
      tool={tool}
      currentVersion={currentVersion}
      activeKey={previewTab}
      onChangeKey={setPreviewTab}
      liveCode={streamCode}
      streaming={generatingCode}
      onVersionSelect={handleVersionSelect}
      onVersionDelete={handleVersionDelete}
      onVersionLabel={handleVersionLabel}
    />
  )

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      <AppHeader />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          padding: '8px 16px',
          borderBottom: '1px solid #303030',
          flexWrap: 'wrap',
        }}
      >
        <Space>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} />
          <Typography.Text strong style={{ cursor: 'pointer' }} onClick={() => setSaveModalOpen(true)}>
            {tool.name} ✏️
          </Typography.Text>
          <Tag color={hasVersions ? 'blue' : 'gold'}>{hasVersions ? '編輯中' : '腦力激盪中'}</Tag>
        </Space>
        <Space>
          {!hasVersions && (
            <Badge dot={ready} offset={[-2, 2]}>
              <Button
                type={ready ? 'primary' : 'default'}
                icon={<ThunderboltOutlined />}
                loading={generatingCode}
                onClick={generate}
              >
                生成工具
              </Button>
            </Badge>
          )}
          <Button icon={<DatabaseOutlined />} onClick={() => setBindOpen(true)}>
            資料{tool.dataSources.length ? ` (${tool.dataSources.length})` : ''}
          </Button>
          <Button icon={<SaveOutlined />} onClick={() => setSaveModalOpen(true)}>
            設定
          </Button>
        </Space>
      </div>

      {isMobile ? (
        <Tabs
          activeKey={mobileTab}
          onChange={setMobileTab}
          style={{ flex: 1, minHeight: 0 }}
          tabBarStyle={{ paddingInline: 12, marginBottom: 0 }}
          items={[
            { key: 'chat', label: '對話', style: { height: 'calc(100vh - 200px)' }, children: chat },
            { key: 'preview', label: '預覽', children: preview },
          ]}
        />
      ) : (
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <div style={{ width: '40%', borderRight: '1px solid #303030', minHeight: 0 }}>{chat}</div>
          <div style={{ flex: 1, minHeight: 0 }}>{preview}</div>
        </div>
      )}

      <DataSourceBinder
        open={bindOpen}
        dataSources={tool.dataSources}
        mcpServers={settings.mcpServers}
        onClose={() => setBindOpen(false)}
        onChange={handleBind}
      />

      <Modal title="工具設定" open={saveModalOpen} onCancel={() => setSaveModalOpen(false)} footer={null}>
        <Form
          initialValues={{ name: tool.name, description: tool.description }}
          onFinish={handleSaveInfo}
          layout="vertical"
        >
          <Form.Item name="name" label="工具名稱" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Button type="primary" htmlType="submit">
            儲存
          </Button>
        </Form>
      </Modal>
    </Layout>
  )
}
