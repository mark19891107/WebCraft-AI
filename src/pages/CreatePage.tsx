import { useRef, useState } from 'react'
import {
  Layout,
  Button,
  Input,
  Space,
  message,
  Modal,
  Form,
  Typography,
  Grid,
  Tabs,
  Tag,
  Badge,
  Alert,
  Switch,
  Tooltip,
  theme,
} from 'antd'
import {
  SaveOutlined,
  ArrowLeftOutlined,
  DatabaseOutlined,
  ThunderboltOutlined,
  BugOutlined,
  ToolOutlined,
} from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import AppHeader from '../components/AppHeader'
import ChatPanel from '../components/ChatPanel'
import PreviewPanel from '../components/PreviewPanel'
import DataSourceBinder from '../components/DataSourceBinder'
import QuestionForm from '../components/QuestionForm'
import PlanPanel from '../components/PlanPanel'
import AgentActivity from '../components/AgentActivity'
import { useTools } from '../hooks/useTools'
import { useSettings } from '../hooks/useSettings'
import { useLLMStream } from '../hooks/useLLMStream'
import { parsePatches, applyPatches, extractExplanation, extractFullHtml, livePatchedCode } from '../services/patch'
import {
  buildFirstTurnSystemPrompt,
  buildPatchSystemPrompt,
  buildBrainstormSystemPrompt,
  buildAgentSystemPrompt,
  READY_MARKER,
} from '../services/systemPrompt'
import { chatWithTools } from '../services/llm'
import { runAgent } from '../agent/runAgent'
import { buildAgentTools } from '../agent/tools'
import { AgentEvent, ApiMessage } from '../agent/types'
import { summarizeBoundData } from '../services/dataSource'
import { suggestToolMeta } from '../services/naming'
import { suggestNextSteps } from '../services/suggestions'
import { proposePlan, PlanStep } from '../services/plan'
import { parseBrainstorm, BrainstormQuestion } from '../services/brainstorm'
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
  const { streaming, lastUsage, streamRaw, streamExplanation, streamCode, start, abort } = useLLMStream()
  const screens = useBreakpoint()
  const { token } = theme.useToken()
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
  const [genKind, setGenKind] = useState<'full' | 'patch'>('full')
  const [ready, setReady] = useState(false)
  const [toolError, setToolError] = useState<string | null>(null)
  const [attachedImages, setAttachedImages] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [plan, setPlan] = useState<PlanStep[] | null>(null)
  const [planning, setPlanning] = useState(false)
  const [planRunning, setPlanRunning] = useState(false)
  const [agentMode, setAgentMode] = useState(false)
  const [agentRunning, setAgentRunning] = useState(false)
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>([])
  const [agentCode, setAgentCode] = useState('')
  const agentAbortRef = useRef<AbortController | null>(null)
  const [questions, setQuestions] = useState<BrainstormQuestion[] | null>(null)

  function fetchSuggestions(convo: Message[]) {
    setSuggestions([])
    suggestNextSteps(settings.llm, convo).then(setSuggestions)
  }
  const [autoFix, setAutoFix] = useState(false)
  const autoFixAttempts = useRef(0)
  const MAX_AUTO_FIX = 2

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

  function commitVersion(code: string, conversation: Message[], baseTool: ToolDefinition = tool) {
    const versionId = uuidv4()
    const version: ToolVersion = {
      versionId,
      parentVersionId: baseTool.currentVersionId || null,
      createdAt: new Date().toISOString(),
      code,
      conversation,
    }
    const updated: ToolDefinition = {
      ...baseTool,
      updatedAt: new Date().toISOString(),
      currentVersionId: versionId,
      versions: [...baseTool.versions, version],
      conversation,
    }
    setTool(updated)
    save(updated)
    if (!id) navigate(`/create/${updated.id}`, { replace: true })
    return updated
  }

  // 首次生成後，若仍是預設名稱，依對話自動命名
  async function autoName(baseTool: ToolDefinition, convo: Message[]) {
    if (baseTool.name !== '新工具') return
    const meta = await suggestToolMeta(settings.llm, convo)
    if (!meta) return
    setTool((prev) => {
      if (prev.id !== baseTool.id || prev.name !== '新工具') return prev
      const u = { ...prev, name: meta.name, description: meta.description || prev.description, updatedAt: new Date().toISOString() }
      save(u)
      return u
    })
  }

  function lastUserIndex(): number {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === 'user') return i
    return -1
  }

  // 編輯回合：把目前版本還原到其上一版（供「重新生成/編輯/刪除最後一則」用）
  function revertedEditTool(): { tool: ToolDefinition; baseCode: string } | null {
    if (!currentVersion) return null
    const parentId = currentVersion.parentVersionId
    const parent = parentId ? tool.versions.find((v) => v.versionId === parentId) : undefined
    return {
      tool: {
        ...tool,
        versions: tool.versions.filter((v) => v.versionId !== currentVersion.versionId),
        currentVersionId: parentId ?? '',
      },
      baseCode: parent?.code ?? '',
    }
  }

  function handleBind(dataSources: DataSource[]) {
    const updated = { ...tool, dataSources, updatedAt: new Date().toISOString() }
    setTool(updated)
    save(updated)
  }

  // 腦力激盪核心：對給定對話產生回應（問題表單 / ready）
  async function brainstormCore(convo: Message[], images?: string[]) {
    setQuestions(null)
    setSuggestions([])
    const schema = await summarizeBoundData(tool.dataSources)
    let full: string
    try {
      full = await start(settings.llm, buildBrainstormSystemPrompt(tool.dataSources, schema), convo, images)
    } catch (err) {
      if (String(err).includes('AbortError')) return
      message.error(`LLM 請求失敗：${err}`)
      return
    }
    const isReady = full.includes(READY_MARKER)
    const form = isReady ? null : parseBrainstorm(full)
    const content =
      extractExplanation(full).split(READY_MARKER).join('').trim() || form?.intro || '（請回答以下問題）'
    const newConversation: Message[] = [...convo, { role: 'assistant', content }]
    setMessages(newConversation)
    persistConversation(newConversation)
    setQuestions(form?.questions ?? null)
    if (isReady) setReady(true)
  }

  function runBrainstorm(userMsg: Message) {
    const convo = [...messages, userMsg]
    const imgs = attachedImages
    setMessages(convo)
    setInput('')
    setAttachedImages([])
    brainstormCore(convo, imgs)
  }

  // 首輪生成：依目前對話生成完整 HTML
  async function generate() {
    if (streaming) return
    if (!llmReady()) return
    if (messages.length === 0) {
      message.warning('請先描述你想要的工具')
      return
    }
    autoFixAttempts.current = 0
    setQuestions(null)
    const schema = await summarizeBoundData(tool.dataSources)
    const triggerMsg: Message = { role: 'user', content: '請根據以上討論，直接生成這個工具。' }
    const genMessages = [...messages, triggerMsg]
    const imgs = attachedImages
    setMessages(genMessages)
    setAttachedImages([])
    setToolError(null)
    setSuggestions([])
    setGenKind('full')
    setGeneratingCode(true)
    setPreviewTab('code')
    setMobileTab('preview')
    let full: string
    try {
      full = await start(settings.llm, buildFirstTurnSystemPrompt(tool.dataSources, schema), genMessages, imgs)
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
    const committed = commitVersion(code, newConversation)
    setReady(false)
    setPreviewTab('tool')
    autoName(committed, newConversation)
    fetchSuggestions(newConversation)
  }

  // A2 規劃：點「生成工具」先請 LLM 產生分步計畫
  async function handlePlanClick() {
    if (streaming || planning || planRunning) return
    if (!llmReady()) return
    if (messages.length === 0) {
      message.warning('請先描述你想要的工具')
      return
    }
    setPlanning(true)
    try {
      setPlan(await proposePlan(settings.llm, messages))
    } catch {
      message.error('產生計畫失敗，可改用「直接生成」')
    } finally {
      setPlanning(false)
    }
  }

  // A2 執行：逐步建構（可從失敗處續做）
  async function runPlan() {
    if (!plan || streaming) return
    autoFixAttempts.current = 0
    setSuggestions([])
    setPreviewTab('code')
    setMobileTab('preview')

    let startIndex = plan.findIndex((s) => s.status !== 'done')
    if (startIndex < 0) return
    setPlan((prev) =>
      prev ? prev.map((s, i) => (i >= startIndex && s.status === 'error' ? { ...s, status: 'todo' } : s)) : prev,
    )
    setPlanRunning(true)

    let workingTool = tool
    let convo = messages
    let code = currentVersion?.code ?? ''

    for (let i = startIndex; i < plan.length; i++) {
      const step = plan[i]
      setPlan((prev) => (prev ? prev.map((s, j) => (j === i ? { ...s, status: 'running' } : s)) : prev))
      const isFirst = !code
      setGenKind(isFirst ? 'full' : 'patch')
      setGeneratingCode(true)
      const stepMsg: Message = {
        role: 'user',
        content: isFirst
          ? `第一步：${step.title}。${step.detail} 先做出可運作的基礎版本。`
          : `下一步：${step.title}。${step.detail}`,
      }
      convo = [...convo, stepMsg]
      setMessages(convo)
      const schema = await summarizeBoundData(workingTool.dataSources)

      let full: string
      try {
        full = await start(
          settings.llm,
          isFirst
            ? buildFirstTurnSystemPrompt(workingTool.dataSources, schema)
            : buildPatchSystemPrompt(code, workingTool.dataSources, schema),
          convo,
        )
      } catch (err) {
        setGeneratingCode(false)
        setPlanRunning(false)
        setPlan((prev) => (prev ? prev.map((s, j) => (j === i ? { ...s, status: 'error' } : s)) : prev))
        if (!String(err).includes('AbortError')) message.error(`第 ${i + 1} 步失敗：${err}`)
        return
      }

      let newCode: string | null
      if (isFirst) {
        newCode = extractFullHtml(full)
      } else {
        const patches = parsePatches(full)
        newCode = patches.length > 0 ? applyPatches(code, patches) : extractFullHtml(full)
        if (!newCode && patches.length > 0) {
          try {
            const fb = await start(settings.llm, buildFirstTurnSystemPrompt(workingTool.dataSources, schema), convo)
            newCode = extractFullHtml(fb)
          } catch {
            newCode = null
          }
        }
      }

      if (!newCode) {
        setGeneratingCode(false)
        setPlanRunning(false)
        setPlan((prev) => (prev ? prev.map((s, j) => (j === i ? { ...s, status: 'error' } : s)) : prev))
        message.warning(`第 ${i + 1} 步未取得程式碼，可按「繼續建構」重試`)
        return
      }

      const explanation = extractExplanation(full) || `完成：${step.title}`
      convo = [...convo, { role: 'assistant', content: explanation }]
      setMessages(convo)
      workingTool = commitVersion(newCode, convo, workingTool)
      code = newCode
      setPlan((prev) => (prev ? prev.map((s, j) => (j === i ? { ...s, status: 'done' } : s)) : prev))
    }

    setGeneratingCode(false)
    setPlanRunning(false)
    setReady(false)
    setPreviewTab('tool')
    autoName(workingTool, convo)
    fetchSuggestions(convo)
  }

  // 編輯核心：對 baseCode 套用 patch，產生新版本（掛在 baseTool 之下）
  async function editCore(convo: Message[], baseCode: string, baseTool: ToolDefinition, images?: string[]) {
    setToolError(null)
    setSuggestions([])
    const schema = await summarizeBoundData(baseTool.dataSources)
    setGenKind('patch')
    setGeneratingCode(true)
    setPreviewTab('code')
    setMobileTab('preview')
    let full: string
    try {
      full = await start(settings.llm, buildPatchSystemPrompt(baseCode, baseTool.dataSources, schema), convo, images)
    } catch (err) {
      setGeneratingCode(false)
      if (String(err).includes('AbortError')) return
      message.error(`LLM 請求失敗：${err}`)
      return
    }

    let newCode: string | null
    const patches = parsePatches(full)
    if (patches.length > 0) {
      newCode = applyPatches(baseCode, patches)
      if (!newCode) {
        message.warning('Patch 套用失敗，正在要求完整重新生成…')
        try {
          const fallback = await start(
            settings.llm,
            buildFirstTurnSystemPrompt(baseTool.dataSources, schema),
            convo,
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
    const newConversation: Message[] = [...convo, { role: 'assistant', content: explanation }]
    setMessages(newConversation)
    commitVersion(newCode, newConversation, baseTool)
    setPreviewTab('tool')
    fetchSuggestions(newConversation)
  }

  function editTurn(userMsg: Message) {
    const convo = [...messages, userMsg]
    const imgs = attachedImages
    setMessages(convo)
    setInput('')
    setAttachedImages([])
    editCore(convo, currentVersion?.code ?? '', tool, imgs)
  }

  // 重新生成最後一則（編輯回合會還原版本後重做）
  function regenerate() {
    if (streaming) return
    const ui = lastUserIndex()
    if (ui < 0) return
    autoFixAttempts.current = 0
    const convo = messages.slice(0, ui + 1)
    setMessages(convo)
    if (!hasVersions) {
      brainstormCore(convo)
      return
    }
    const r = revertedEditTool()
    if (!r) return
    editCore(convo, r.baseCode, r.tool)
  }

  // 把最後一則使用者訊息載回輸入框、移除該回合（含還原版本），讓使用者改寫後重送
  function editLast() {
    if (streaming) return
    const ui = lastUserIndex()
    if (ui < 0) return
    setInput(messages[ui].content)
    const prior = messages.slice(0, ui)
    setMessages(prior)
    setQuestions(null)
    if (hasVersions) {
      const r = revertedEditTool()
      if (r) {
        setTool(r.tool)
        save(r.tool)
      }
    } else {
      persistConversation(prior)
    }
  }

  function deleteLast() {
    if (streaming) return
    const ui = lastUserIndex()
    if (ui < 0) return
    const prior = messages.slice(0, ui)
    setMessages(prior)
    setQuestions(null)
    if (hasVersions) {
      const r = revertedEditTool()
      if (r) {
        setTool(r.tool)
        save(r.tool)
      }
    } else {
      persistConversation(prior)
    }
  }

  // 把錯誤訊息餵給 LLM 修正，產生新版本
  function repair(errMsg: string) {
    if (streaming) return
    setToolError(null)
    editTurn({
      role: 'user',
      content: `這個工具在瀏覽器執行時發生 JavaScript 錯誤，請修正並確保不再發生：\n\n${errMsg}`,
    })
  }

  // 收到工具執行期錯誤
  function handleToolError(msg: string) {
    if (streaming || generatingCode) return
    setToolError(msg)
    if (autoFix && autoFixAttempts.current < MAX_AUTO_FIX) {
      autoFixAttempts.current += 1
      repair(msg)
    }
  }

  function manualRepair() {
    if (!toolError) return
    autoFixAttempts.current = 0
    repair(toolError)
  }

  // Deep Agent（Phase 1）：LLM 以工具呼叫自主完成讀資料→寫碼→自測→修錯
  async function runAgentTurn(userMsg: Message) {
    const convo = [...messages, userMsg]
    setMessages(convo)
    setInput('')
    setQuestions(null)
    setSuggestions([])
    setPlan(null)
    setToolError(null)
    setAgentEvents([])

    const baseCode = currentVersion?.code ?? ''
    let working = baseCode
    setAgentCode(baseCode)
    const tools = buildAgentTools({
      tool,
      getCode: () => working,
      setCode: (c) => {
        working = c
        setAgentCode(c)
      },
    })

    agentAbortRef.current = new AbortController()
    setAgentRunning(true)
    setGeneratingCode(true)
    setPreviewTab('code')
    setMobileTab('preview')

    try {
      const { summary } = await runAgent({
        chat: (msgs, defs, signal) =>
          chatWithTools({ settings: settings.llm, messages: msgs, tools: defs, signal }),
        tools,
        systemPrompt: buildAgentSystemPrompt(tool.dataSources, baseCode),
        conversation: convo.map((m): ApiMessage => ({ role: m.role, content: m.content })),
        signal: agentAbortRef.current.signal,
        onEvent: (e) => setAgentEvents((prev) => [...prev, e]),
      })
      const newConvo: Message[] = [...convo, { role: 'assistant', content: summary }]
      setMessages(newConvo)
      if (working && working !== baseCode) {
        const committed = commitVersion(working, newConvo)
        setPreviewTab('tool')
        autoName(committed, newConvo)
      } else {
        persistConversation(newConvo)
      }
      fetchSuggestions(newConvo)
    } catch (err) {
      if (!String(err).includes('AbortError')) {
        setAgentEvents((prev) => [...prev, { type: 'error', message: String(err) }])
        message.error(`Agent 執行失敗：${err}`)
      }
    } finally {
      setAgentRunning(false)
      setGeneratingCode(false)
    }
  }

  function handleSend() {
    if (!input.trim() || streaming || agentRunning) return
    if (!llmReady()) return
    autoFixAttempts.current = 0
    setPlan(null)
    const userMsg: Message = { role: 'user', content: input }
    if (agentMode) runAgentTurn(userMsg)
    else if (hasVersions) editTurn(userMsg)
    else runBrainstorm(userMsg)
  }

  function handleAbort() {
    abort()
    agentAbortRef.current?.abort()
  }

  // 腦力激盪問題表單：答完一次送回 LLM 開下一輪
  function handleAnswers(compiled: string) {
    if (streaming) return
    runBrainstorm({ role: 'user', content: compiled })
  }

  // 點擊主動建議 = 當成一則修改送出
  function handleSuggestion(text: string) {
    if (streaming || agentRunning) return
    autoFixAttempts.current = 0
    setSuggestions([])
    const msg: Message = { role: 'user', content: text }
    if (agentMode) runAgentTurn(msg)
    else if (hasVersions) editTurn(msg)
    else runBrainstorm(msg)
  }

  function handleVersionSelect(versionId: string) {
    const version = tool.versions.find((v) => v.versionId === versionId)
    if (!version) return
    autoFixAttempts.current = 0
    setToolError(null)
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

  function handlePruneVersions() {
    if (!currentVersion) return
    const kept: ToolVersion = { ...currentVersion, parentVersionId: null }
    const updated = { ...tool, versions: [kept], currentVersionId: kept.versionId, updatedAt: new Date().toISOString() }
    setTool(updated)
    save(updated)
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
      streaming={streaming || agentRunning}
      streamText={streamExplanation}
      input={input}
      onInputChange={setInput}
      onSend={handleSend}
      onAbort={handleAbort}
      onRegenerate={regenerate}
      onEditLast={editLast}
      onDeleteLast={deleteLast}
      images={attachedImages}
      onAddImage={(url) => setAttachedImages((prev) => [...prev, url])}
      onRemoveImage={(i) => setAttachedImages((prev) => prev.filter((_, j) => j !== i))}
      suggestions={suggestions}
      onSuggestion={handleSuggestion}
      placeholder={hasVersions ? '描述要修改的地方…' : '描述你想要的工具，我會先問幾個問題…'}
      belowMessages={
        agentRunning || (agentMode && agentEvents.length > 0) ? (
          <AgentActivity events={agentEvents} running={agentRunning} />
        ) : plan ? (
          <PlanPanel
            steps={plan}
            running={planRunning}
            onRemove={(i) => setPlan((prev) => (prev ? prev.filter((_, j) => j !== i) : prev))}
            onStart={runPlan}
            onSkip={() => {
              setPlan(null)
              generate()
            }}
            onCancel={() => setPlan(null)}
          />
        ) : !hasVersions && questions ? (
          <QuestionForm questions={questions} disabled={streaming} onSubmit={handleAnswers} />
        ) : null
      }
    />
  )

  // patch 回合：把已完成的 patch 即時套到目前程式碼，讓使用者看到程式碼在變（而非空白卡住）
  const liveCode = agentRunning
    ? agentCode
    : genKind === 'patch'
      ? livePatchedCode(currentVersion?.code ?? '', streamRaw)
      : streamCode

  const preview = (
    <PreviewPanel
      tool={tool}
      currentVersion={currentVersion}
      activeKey={previewTab}
      onChangeKey={setPreviewTab}
      liveCode={liveCode}
      streaming={generatingCode}
      onToolError={handleToolError}
      onVersionSelect={handleVersionSelect}
      onVersionDelete={handleVersionDelete}
      onVersionLabel={handleVersionLabel}
      onPruneVersions={handlePruneVersions}
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
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          flexWrap: 'wrap',
        }}
      >
        <Space>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} />
          <Typography.Text strong style={{ cursor: 'pointer' }} onClick={() => setSaveModalOpen(true)}>
            {tool.name} ✏️
          </Typography.Text>
          <Tag color={hasVersions ? 'blue' : 'gold'}>{hasVersions ? '編輯中' : '腦力激盪中'}</Tag>
          {lastUsage?.total_tokens != null && (
            <Tooltip
              title={`輸入 ${lastUsage.prompt_tokens ?? '?'} + 輸出 ${lastUsage.completion_tokens ?? '?'} tokens`}
            >
              <Tag>上次 {lastUsage.total_tokens} tokens</Tag>
            </Tooltip>
          )}
        </Space>
        <Space>
          <Tooltip title="Agent 模式（實驗性）：AI 自主讀資料、寫程式、自我測試並修錯">
            <Space size={4}>
              🤖
              <Switch size="small" checked={agentMode} onChange={setAgentMode} disabled={agentRunning} />
            </Space>
          </Tooltip>
          {!hasVersions && !agentMode && (
            <Badge dot={ready} offset={[-2, 2]}>
              <Button
                type={ready ? 'primary' : 'default'}
                icon={<ThunderboltOutlined />}
                loading={planning || planRunning || generatingCode}
                onClick={handlePlanClick}
              >
                生成工具
              </Button>
            </Badge>
          )}
          {hasVersions && (
            <Tooltip title="偵測到工具執行錯誤時自動修復（最多連續 2 次）">
              <Space size={4}>
                <ToolOutlined />
                <Switch size="small" checked={autoFix} onChange={setAutoFix} />
              </Space>
            </Tooltip>
          )}
          <Button icon={<DatabaseOutlined />} onClick={() => setBindOpen(true)}>
            資料{tool.dataSources.length ? ` (${tool.dataSources.length})` : ''}
          </Button>
          <Button icon={<SaveOutlined />} onClick={() => setSaveModalOpen(true)}>
            設定
          </Button>
        </Space>
      </div>

      {toolError && !generatingCode && !streaming && (
        <Alert
          type="error"
          showIcon
          banner
          closable
          onClose={() => setToolError(null)}
          message={
            <Typography.Text ellipsis style={{ maxWidth: '60vw' }}>
              工具執行錯誤：{toolError}
            </Typography.Text>
          }
          action={
            <Button size="small" danger icon={<BugOutlined />} onClick={manualRepair}>
              自動修復
            </Button>
          }
        />
      )}

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
          <div
            style={{
              flex: '0 0 400px',
              width: 400,
              borderRight: `1px solid ${token.colorBorderSecondary}`,
              minHeight: 0,
              minWidth: 0,
            }}
          >
            {chat}
          </div>
          <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden' }}>{preview}</div>
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
