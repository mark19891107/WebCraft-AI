import { useState } from 'react'
import { Layout, Button, Input, Space, message, Modal, Form, Typography, Grid, Tabs } from 'antd'
import { SaveOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import AppHeader from '../components/AppHeader'
import ChatPanel from '../components/ChatPanel'
import PreviewPanel from '../components/PreviewPanel'
import { useTools } from '../hooks/useTools'
import { useSettings } from '../hooks/useSettings'
import { useLLMStream } from '../hooks/useLLMStream'
import { parsePatches, applyPatches, extractExplanation, extractFullHtml } from '../services/patch'
import { buildFirstTurnSystemPrompt, buildPatchSystemPrompt } from '../services/systemPrompt'
import { ToolDefinition, ToolVersion, Message } from '../types'

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
  const { streaming, streamText, start, abort } = useLLMStream()
  const screens = useBreakpoint()
  const isMobile = screens.md === false

  const [tool, setTool] = useState<ToolDefinition>(() => (id ? getTool(id) ?? newTool('新工具') : newTool('新工具')))
  const currentVersion = tool.versions.find((v) => v.versionId === tool.currentVersionId)
  const [messages, setMessages] = useState<Message[]>(() => currentVersion?.conversation ?? [])
  const [input, setInput] = useState('')
  const [saveModalOpen, setSaveModalOpen] = useState(false)

  async function handleSend() {
    if (!input.trim() || streaming) return
    if (!settings.llm.endpoint || !settings.llm.apiKey) {
      message.error('請先在設定頁填入 LLM Endpoint 與 API Key')
      return
    }

    const isFirstTurn = tool.versions.length === 0
    const userMsg: Message = { role: 'user', content: input }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput('')

    const systemPrompt = isFirstTurn
      ? buildFirstTurnSystemPrompt(tool.dataSources)
      : buildPatchSystemPrompt(currentVersion?.code ?? '', tool.dataSources)

    let fullResponse: string
    try {
      fullResponse = await start(settings.llm, systemPrompt, updatedMessages)
    } catch (err) {
      if (String(err).includes('AbortError')) return
      message.error(`LLM 請求失敗：${err}`)
      return
    }

    let newCode: string | null
    if (isFirstTurn) {
      newCode = extractFullHtml(fullResponse)
    } else {
      const patches = parsePatches(fullResponse)
      if (patches.length > 0) {
        newCode = applyPatches(currentVersion?.code ?? '', patches)
        if (!newCode) {
          message.warning('Patch 套用失敗，正在要求完整重新生成…')
          try {
            const fallback = await start(
              settings.llm,
              buildFirstTurnSystemPrompt(tool.dataSources),
              updatedMessages,
            )
            newCode = extractFullHtml(fallback)
          } catch {
            message.error('重新生成失敗')
            return
          }
        }
      } else {
        newCode = extractFullHtml(fullResponse)
      }
    }

    if (!newCode) {
      message.warning('未能從 LLM 回應中取得程式碼，請重試')
      return
    }

    const explanation = extractExplanation(fullResponse) || '已更新工具。'
    const newConversation: Message[] = [...updatedMessages, { role: 'assistant', content: explanation }]
    setMessages(newConversation)

    const versionId = uuidv4()
    const newVersion: ToolVersion = {
      versionId,
      parentVersionId: tool.currentVersionId || null,
      createdAt: new Date().toISOString(),
      code: newCode,
      conversation: newConversation,
    }
    const updatedTool: ToolDefinition = {
      ...tool,
      updatedAt: new Date().toISOString(),
      currentVersionId: versionId,
      versions: [...tool.versions, newVersion],
      conversation: newConversation,
    }
    setTool(updatedTool)
    save(updatedTool)
    if (!id) navigate(`/create/${updatedTool.id}`, { replace: true })
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
      streamText={streamText}
      input={input}
      onInputChange={setInput}
      onSend={handleSend}
      onAbort={abort}
    />
  )

  const preview = (
    <PreviewPanel
      tool={tool}
      currentVersion={currentVersion}
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
        }}
      >
        <Space>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} />
          <Typography.Text
            strong
            style={{ cursor: 'pointer' }}
            onClick={() => setSaveModalOpen(true)}
          >
            {tool.name} ✏️
          </Typography.Text>
        </Space>
        <Button icon={<SaveOutlined />} onClick={() => setSaveModalOpen(true)}>
          設定
        </Button>
      </div>

      {isMobile ? (
        <Tabs
          defaultActiveKey="chat"
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
