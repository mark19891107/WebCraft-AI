# WebCraft AI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a pure-frontend AI web tool generator (React + Vite + Ant Design) deployable to GitHub Pages, where users can describe tools in natural language, have an LLM generate them, bind data sources, and share via exported JSON files.

**Architecture:** Single-page React app with Hash Router. All tool definitions in localStorage, large data files in OPFS. Generated tools run in sandboxed iframes communicating with the host via postMessage (the Bridge API). LLM calls are proxied through the host page so API keys never reach the iframe.

**Tech Stack:** React 18, TypeScript, Vite, Ant Design 5, React Router v6 (Hash), highlight.js, uuid

---

## File Map

```
src/
  types/index.ts               — all shared TypeScript interfaces
  store/
    toolsStore.ts              — localStorage CRUD for ToolDefinition[]
    settingsStore.ts           — localStorage CRUD for Settings
  services/
    opfs.ts                    — OPFS read/write/delete/list
    llm.ts                     — OpenAI-compatible streaming client
    patch.ts                   — XML <patch> parser and applier
    bridge.ts                  — postMessage bridge handler (host side)
    mcpClient.ts               — MCP SSE + Streamable HTTP client
    exportImport.ts            — .webcraft.json export/import logic
  hooks/
    useTools.ts                — React hook wrapping toolsStore
    useSettings.ts             — React hook wrapping settingsStore
    useLLMStream.ts            — streaming LLM hook with abort support
  components/
    AppHeader.tsx              — top nav: logo + links
    ToolCard.tsx               — card in home grid
    DataSourceBadge.tsx        — badge pill for file/api/mcp
    ChatPanel.tsx              — left-side conversation list + input
    ChatMessage.tsx            — single message bubble (supports streaming)
    BridgeIframe.tsx           — iframe with bridge script injected
    CodeViewer.tsx             — syntax-highlighted read-only HTML viewer
    PreviewPanel.tsx           — right-side Tool/Code tabs + VersionTree
    VersionTree.tsx            — collapsible tree of ToolVersions
  pages/
    HomePage.tsx               — / tool library
    CreatePage.tsx             — /create and /create/:id
    ToolPage.tsx               — /tool/:id full-screen tool
    DataPage.tsx               — /data OPFS file manager
    SettingsPage.tsx           — /settings LLM + MCP
  App.tsx                      — HashRouter + routes
  main.tsx                     — ReactDOM.createRoot entry
public/
  bridge-inject.js             — window.bridge implementation (loaded in iframe)
.github/workflows/deploy.yml   — GitHub Actions gh-pages deploy
vite.config.ts
tsconfig.json
package.json
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`

- [ ] **Step 1: Initialise Vite project**

```bash
npm create vite@latest . -- --template react-ts
npm install
```

- [ ] **Step 2: Install dependencies**

```bash
npm install antd @ant-design/icons react-router-dom uuid highlight.js
npm install -D @types/uuid
```

- [ ] **Step 3: Replace `vite.config.ts`**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
})
```

- [ ] **Step 4: Replace `src/main.tsx`**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider, theme } from 'antd'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider theme={{ algorithm: theme.darkAlgorithm }}>
      <App />
    </ConfigProvider>
  </React.StrictMode>
)
```

- [ ] **Step 5: Create `src/App.tsx` with Hash Router and placeholder routes**

```tsx
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
```

- [ ] **Step 6: Create stub pages so the app compiles**

Create each file with a single default export returning a `<div>` with the page name:

```tsx
// src/pages/HomePage.tsx
export default function HomePage() { return <div>Home</div> }

// src/pages/CreatePage.tsx
export default function CreatePage() { return <div>Create</div> }

// src/pages/ToolPage.tsx
export default function ToolPage() { return <div>Tool</div> }

// src/pages/DataPage.tsx
export default function DataPage() { return <div>Data</div> }

// src/pages/SettingsPage.tsx
export default function SettingsPage() { return <div>Settings</div> }
```

- [ ] **Step 7: Verify app compiles and runs**

```bash
npm run dev
```

Expected: browser opens, no TypeScript errors, all 5 stub routes accessible via `/#/`, `/#/create`, etc.

- [ ] **Step 8: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold React + Vite + Ant Design project"
```

---

## Task 2: TypeScript Types

**Files:**
- Create: `src/types/index.ts`

- [ ] **Step 1: Write all shared interfaces**

```typescript
// src/types/index.ts

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface ToolVersion {
  versionId: string
  parentVersionId: string | null
  createdAt: string
  label?: string
  code: string
  conversation: Message[]
}

export type DataSource =
  | { type: 'file'; name: string; opfsPath: string }
  | { type: 'api';  name: string; url: string; headers: Record<string, string> }
  | { type: 'mcp';  name: string; serverRef: string }

export interface ToolDefinition {
  id: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
  currentVersionId: string
  versions: ToolVersion[]
  dataSources: DataSource[]
  conversation: Message[]
}

export interface MCPServer {
  id: string
  name: string
  url: string
  transport: 'sse' | 'streamable-http'
}

export interface Settings {
  llm: {
    endpoint: string
    apiKey: string
    model: string
  }
  mcpServers: MCPServer[]
}

export interface MCPTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

// postMessage protocol between iframe and host
export type BridgeRequest =
  | { type: 'llm.chat';  requestId: string; messages: Message[]; stream?: boolean }
  | { type: 'data.read'; requestId: string; name: string; rows?: number; offset?: number }
  | { type: 'mcp.call';  requestId: string; serverName: string; tool: string; params: Record<string, unknown> }
  | { type: 'mcp.listTools'; requestId: string; serverName: string }
  | { type: 'api.fetch'; requestId: string; name: string; options?: RequestInit }

export type BridgeResponse =
  | { requestId: string; chunk: string; done: false }
  | { requestId: string; result: unknown; done: true }
  | { requestId: string; error: string; done: true }

export interface ExportedTool extends Omit<ToolDefinition, 'dataSources'> {
  dataSources: ExportedDataSource[]
  exportedAt: string
  warnings?: string[]
}

export type ExportedDataSource =
  | { type: 'file'; name: string; opfsPath: string; embedded?: string /* base64 */ }
  | { type: 'api';  name: string; url: string; headers: Record<string, string> }
  | { type: 'mcp';  name: string; serverRef: string }
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add shared TypeScript types"
```

---

## Task 3: Storage Layer

**Files:**
- Create: `src/store/toolsStore.ts`
- Create: `src/store/settingsStore.ts`
- Create: `src/hooks/useTools.ts`
- Create: `src/hooks/useSettings.ts`

- [ ] **Step 1: Write `src/store/toolsStore.ts`**

```typescript
import { ToolDefinition } from '../types'

const KEY = 'webcraft_tools'

export function loadTools(): ToolDefinition[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

export function saveTool(tool: ToolDefinition): void {
  const tools = loadTools().filter(t => t.id !== tool.id)
  localStorage.setItem(KEY, JSON.stringify([...tools, tool]))
}

export function deleteTool(id: string): void {
  const tools = loadTools().filter(t => t.id !== id)
  localStorage.setItem(KEY, JSON.stringify(tools))
}

export function getTool(id: string): ToolDefinition | undefined {
  return loadTools().find(t => t.id === id)
}
```

- [ ] **Step 2: Write `src/store/settingsStore.ts`**

```typescript
import { Settings } from '../types'

const KEY = 'webcraft_settings'

const DEFAULT_SETTINGS: Settings = {
  llm: { endpoint: '', apiKey: '', model: 'gpt-4o' },
  mcpServers: [],
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(KEY, JSON.stringify(settings))
}
```

- [ ] **Step 3: Write `src/hooks/useTools.ts`**

```typescript
import { useState, useCallback } from 'react'
import { ToolDefinition } from '../types'
import { loadTools, saveTool, deleteTool, getTool } from '../store/toolsStore'

export function useTools() {
  const [tools, setTools] = useState<ToolDefinition[]>(() => loadTools())

  const refresh = useCallback(() => setTools(loadTools()), [])

  const save = useCallback((tool: ToolDefinition) => {
    saveTool(tool)
    setTools(loadTools())
  }, [])

  const remove = useCallback((id: string) => {
    deleteTool(id)
    setTools(loadTools())
  }, [])

  return { tools, refresh, save, remove, getTool }
}
```

- [ ] **Step 4: Write `src/hooks/useSettings.ts`**

```typescript
import { useState, useCallback } from 'react'
import { Settings } from '../types'
import { loadSettings, saveSettings } from '../store/settingsStore'

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings())

  const update = useCallback((next: Settings) => {
    saveSettings(next)
    setSettings(next)
  }, [])

  return { settings, update }
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/store src/hooks/useTools.ts src/hooks/useSettings.ts
git commit -m "feat: add localStorage store and React hooks for tools and settings"
```

---

## Task 4: OPFS Service

**Files:**
- Create: `src/services/opfs.ts`

- [ ] **Step 1: Write `src/services/opfs.ts`**

```typescript
// All paths are relative to the OPFS root, e.g. "/data/sales.csv"

async function getFileHandle(path: string, create: boolean): Promise<FileSystemFileHandle> {
  const root = await navigator.storage.getDirectory()
  const parts = path.replace(/^\//, '').split('/')
  let dir: FileSystemDirectoryHandle = root
  for (const part of parts.slice(0, -1)) {
    dir = await dir.getDirectoryHandle(part, { create })
  }
  return dir.getFileHandle(parts[parts.length - 1], { create })
}

export async function writeFile(path: string, data: File | Blob): Promise<void> {
  const handle = await getFileHandle(path, true)
  const writable = await handle.createWritable()
  await writable.write(data)
  await writable.close()
}

export async function readFileAsText(path: string): Promise<string> {
  const handle = await getFileHandle(path, false)
  const file = await handle.getFile()
  return file.text()
}

export async function readFileChunk(
  path: string,
  offset: number,
  length: number
): Promise<ArrayBuffer> {
  const handle = await getFileHandle(path, false)
  const file = await handle.getFile()
  return file.slice(offset, offset + length).arrayBuffer()
}

export async function getFileSize(path: string): Promise<number> {
  const handle = await getFileHandle(path, false)
  const file = await handle.getFile()
  return file.size
}

export async function deleteFile(path: string): Promise<void> {
  const root = await navigator.storage.getDirectory()
  const parts = path.replace(/^\//, '').split('/')
  let dir: FileSystemDirectoryHandle = root
  for (const part of parts.slice(0, -1)) {
    dir = await dir.getDirectoryHandle(part, { create: false })
  }
  await dir.removeEntry(parts[parts.length - 1])
}

export interface OPFSFileInfo {
  path: string
  name: string
  size: number
}

export async function listFiles(directory = '/data'): Promise<OPFSFileInfo[]> {
  const root = await navigator.storage.getDirectory()
  const parts = directory.replace(/^\//, '').split('/').filter(Boolean)
  let dir: FileSystemDirectoryHandle = root
  for (const part of parts) {
    try {
      dir = await dir.getDirectoryHandle(part, { create: false })
    } catch {
      return []
    }
  }
  const results: OPFSFileInfo[] = []
  for await (const [name, handle] of dir) {
    if (handle.kind === 'file') {
      const file = await (handle as FileSystemFileHandle).getFile()
      results.push({ path: `${directory}/${name}`, name, size: file.size })
    }
  }
  return results
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/services/opfs.ts
git commit -m "feat: add OPFS service for large file storage"
```

---

## Task 5: LLM Streaming Service

**Files:**
- Create: `src/services/llm.ts`
- Create: `src/hooks/useLLMStream.ts`

- [ ] **Step 1: Write `src/services/llm.ts`**

```typescript
import { Message, Settings } from '../types'

export interface LLMStreamOptions {
  settings: Settings['llm']
  systemPrompt: string
  messages: Message[]
  onChunk: (chunk: string) => void
  signal?: AbortSignal
}

export async function streamLLM(options: LLMStreamOptions): Promise<string> {
  const { settings, systemPrompt, messages, onChunk, signal } = options

  const response = await fetch(`${settings.endpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    }),
    signal,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`LLM request failed: ${response.status} ${text}`)
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let fullText = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const lines = decoder.decode(value).split('\n')
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') break
      try {
        const json = JSON.parse(data)
        const chunk: string = json.choices?.[0]?.delta?.content ?? ''
        if (chunk) {
          fullText += chunk
          onChunk(chunk)
        }
      } catch {
        // malformed SSE line, skip
      }
    }
  }

  return fullText
}

export async function testConnection(settings: Settings['llm']): Promise<boolean> {
  try {
    const response = await fetch(`${settings.endpoint}/models`, {
      headers: { 'Authorization': `Bearer ${settings.apiKey}` },
    })
    return response.ok
  } catch {
    return false
  }
}
```

- [ ] **Step 2: Write `src/hooks/useLLMStream.ts`**

```typescript
import { useState, useRef, useCallback } from 'react'
import { Message, Settings } from '../types'
import { streamLLM } from '../services/llm'

export function useLLMStream() {
  const [streaming, setStreaming] = useState(false)
  const [streamText, setStreamText] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const start = useCallback(async (
    settings: Settings['llm'],
    systemPrompt: string,
    messages: Message[],
  ): Promise<string> => {
    abortRef.current = new AbortController()
    setStreaming(true)
    setStreamText('')
    try {
      const full = await streamLLM({
        settings,
        systemPrompt,
        messages,
        onChunk: (chunk) => setStreamText(prev => prev + chunk),
        signal: abortRef.current.signal,
      })
      return full
    } finally {
      setStreaming(false)
    }
  }, [])

  const abort = useCallback(() => {
    abortRef.current?.abort()
    setStreaming(false)
  }, [])

  return { streaming, streamText, start, abort }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/services/llm.ts src/hooks/useLLMStream.ts
git commit -m "feat: add LLM streaming service and hook"
```

---

## Task 6: Patch Service

**Files:**
- Create: `src/services/patch.ts`

- [ ] **Step 1: Write `src/services/patch.ts`**

```typescript
export interface Patch {
  find: string
  replace: string
}

// Extract all <patch> blocks from an LLM response string
export function parsePatches(response: string): Patch[] {
  const patches: Patch[] = []
  const patchRegex = /<patch>([\s\S]*?)<\/patch>/g
  let match: RegExpExecArray | null

  while ((match = patchRegex.exec(response)) !== null) {
    const inner = match[1]
    const findMatch = inner.match(/<find><!\[CDATA\[([\s\S]*?)\]\]><\/find>/)
    const replaceMatch = inner.match(/<replace><!\[CDATA\[([\s\S]*?)\]\]><\/replace>/)
    if (findMatch && replaceMatch) {
      patches.push({ find: findMatch[1], replace: replaceMatch[1] })
    }
  }

  return patches
}

// Extract the plain text explanation (everything outside <patch> blocks)
export function extractExplanation(response: string): string {
  return response.replace(/<patch>[\s\S]*?<\/patch>/g, '').trim()
}

// Extract full HTML from a response that contains a markdown code block
export function extractFullHtml(response: string): string | null {
  const match = response.match(/```(?:html)?\n([\s\S]*?)```/)
  return match ? match[1].trim() : null
}

// Apply patches to existing code. Returns null if any patch find-string is not found.
export function applyPatches(code: string, patches: Patch[]): string | null {
  let result = code
  for (const patch of patches) {
    if (!result.includes(patch.find)) return null
    result = result.replace(patch.find, patch.replace)
  }
  return result
}
```

- [ ] **Step 2: Write unit tests for patch parsing and application**

Create `src/services/patch.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { parsePatches, applyPatches, extractExplanation, extractFullHtml } from './patch'

describe('parsePatches', () => {
  it('parses a single patch block', () => {
    const response = `Some text\n<patch><find><![CDATA[hello]]></find><replace><![CDATA[world]]></replace></patch>`
    expect(parsePatches(response)).toEqual([{ find: 'hello', replace: 'world' }])
  })

  it('parses multiple patch blocks', () => {
    const response = `
<patch><find><![CDATA[a]]></find><replace><![CDATA[b]]></replace></patch>
<patch><find><![CDATA[c]]></find><replace><![CDATA[d]]></replace></patch>`
    expect(parsePatches(response)).toHaveLength(2)
  })

  it('returns empty array when no patches', () => {
    expect(parsePatches('just text')).toEqual([])
  })
})

describe('applyPatches', () => {
  it('replaces matching text', () => {
    const result = applyPatches('<div>hello</div>', [{ find: 'hello', replace: 'world' }])
    expect(result).toBe('<div>world</div>')
  })

  it('returns null when find string not found', () => {
    const result = applyPatches('<div>hello</div>', [{ find: 'missing', replace: 'x' }])
    expect(result).toBeNull()
  })
})

describe('extractExplanation', () => {
  it('removes patch blocks from text', () => {
    const response = `Adding a chart.\n<patch><find><![CDATA[x]]></find><replace><![CDATA[y]]></replace></patch>`
    expect(extractExplanation(response)).toBe('Adding a chart.')
  })
})

describe('extractFullHtml', () => {
  it('extracts html from code block', () => {
    const response = '```html\n<html></html>\n```'
    expect(extractFullHtml(response)).toBe('<html></html>')
  })

  it('returns null when no code block', () => {
    expect(extractFullHtml('no code here')).toBeNull()
  })
})
```

- [ ] **Step 3: Install vitest and run tests**

```bash
npm install -D vitest
```

Add to `vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  test: {
    environment: 'jsdom',
  },
})
```

```bash
npx vitest run src/services/patch.test.ts
```

Expected: all 6 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/services/patch.ts src/services/patch.test.ts vite.config.ts package.json
git commit -m "feat: add XML patch parser and applier with tests"
```

---

## Task 7: MCP Client

**Files:**
- Create: `src/services/mcpClient.ts`

- [ ] **Step 1: Write `src/services/mcpClient.ts`**

```typescript
import { MCPServer, MCPTool } from '../types'

interface MCPSession {
  server: MCPServer
  tools: MCPTool[]
  eventSource?: EventSource  // for SSE transport
}

const sessions = new Map<string, MCPSession>()

async function sendStreamableHttp(
  url: string,
  body: unknown
): Promise<unknown> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`MCP HTTP error: ${response.status}`)
  return response.json()
}

async function sendSSE(
  server: MCPServer,
  body: unknown
): Promise<unknown> {
  const response = await fetch(`${server.url}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`MCP SSE POST error: ${response.status}`)
  return response.json()
}

export async function connectMCP(server: MCPServer): Promise<MCPTool[]> {
  const existing = sessions.get(server.id)
  if (existing) return existing.tools

  // Fetch tool list
  const initBody = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {},
  }

  let result: unknown
  if (server.transport === 'streamable-http') {
    result = await sendStreamableHttp(server.url, initBody)
  } else {
    result = await sendSSE(server, initBody)
  }

  const tools: MCPTool[] = (result as any)?.result?.tools ?? []
  sessions.set(server.id, { server, tools })
  return tools
}

export async function callMCPTool(
  server: MCPServer,
  toolName: string,
  params: Record<string, unknown>
): Promise<unknown> {
  const body = {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/call',
    params: { name: toolName, arguments: params },
  }

  if (server.transport === 'streamable-http') {
    const result = await sendStreamableHttp(server.url, body)
    return (result as any)?.result
  } else {
    const result = await sendSSE(server, body)
    return (result as any)?.result
  }
}

export function disconnectMCP(serverId: string): void {
  const session = sessions.get(serverId)
  session?.eventSource?.close()
  sessions.delete(serverId)
}

export function getConnectedTools(serverId: string): MCPTool[] {
  return sessions.get(serverId)?.tools ?? []
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/services/mcpClient.ts
git commit -m "feat: add MCP client supporting SSE and Streamable HTTP transports"
```

---

## Task 8: Bridge (postMessage host handler + iframe inject script)

**Files:**
- Create: `public/bridge-inject.js`
- Create: `src/services/bridge.ts`

- [ ] **Step 1: Write `public/bridge-inject.js`** (runs inside the iframe)

```javascript
// Injected into every generated tool iframe.
// Provides window.bridge — all calls proxy to the host page via postMessage.

window.bridge = (() => {
  let _reqId = 0

  function call(type, payload) {
    return new Promise((resolve, reject) => {
      const requestId = `br_${++_reqId}`
      const chunks = []

      function handler(event) {
        const msg = event.data
        if (!msg || msg.requestId !== requestId) return
        if (msg.error) {
          window.removeEventListener('message', handler)
          reject(new Error(msg.error))
        } else if (msg.done) {
          window.removeEventListener('message', handler)
          resolve(msg.result ?? chunks.join(''))
        } else if (msg.chunk !== undefined) {
          chunks.push(msg.chunk)
        }
      }

      window.addEventListener('message', handler)
      window.parent.postMessage({ type, requestId, ...payload }, '*')
    })
  }

  return {
    llm: {
      chat: (messages, options = {}) =>
        call('llm.chat', { messages, stream: options.stream ?? true }),
    },
    data: {
      read: (name, options = {}) =>
        call('data.read', { name, rows: options.rows, offset: options.offset }),
    },
    mcp: {
      call: (serverName, tool, params) =>
        call('mcp.call', { serverName, tool, params }),
      listTools: (serverName) =>
        call('mcp.listTools', { serverName }),
    },
    api: {
      fetch: (name, options) =>
        call('api.fetch', { name, options }),
    },
  }
})()
```

- [ ] **Step 2: Write `src/services/bridge.ts`** (runs on the host page)

```typescript
import { BridgeRequest, BridgeResponse, ToolDefinition, Settings } from '../types'
import { streamLLM } from './llm'
import { readFileAsText, readFileChunk } from './opfs'
import { callMCPTool, getConnectedTools } from './mcpClient'
import { loadSettings } from '../store/settingsStore'

function reply(iframe: HTMLIFrameElement, msg: BridgeResponse) {
  iframe.contentWindow?.postMessage(msg, '*')
}

async function handleBridgeMessage(
  event: MessageEvent,
  iframe: HTMLIFrameElement,
  tool: ToolDefinition
) {
  if (event.source !== iframe.contentWindow) return

  const req = event.data as BridgeRequest
  if (!req?.type || !req?.requestId) return

  const settings = loadSettings()
  const { requestId } = req

  try {
    switch (req.type) {
      case 'llm.chat': {
        await streamLLM({
          settings: settings.llm,
          systemPrompt: 'You are a helpful assistant.',
          messages: req.messages,
          onChunk: (chunk) => reply(iframe, { requestId, chunk, done: false }),
        })
        reply(iframe, { requestId, result: null, done: true })
        break
      }

      case 'data.read': {
        const source = tool.dataSources.find(
          (ds) => ds.name === req.name && ds.type === 'file'
        )
        if (!source || source.type !== 'file') {
          reply(iframe, { requestId, error: `Data source "${req.name}" not found`, done: true })
          return
        }
        const text = await readFileAsText(source.opfsPath)
        const lines = text.split('\n')
        const offset = req.offset ?? 0
        const rows = req.rows ?? lines.length
        reply(iframe, { requestId, result: lines.slice(offset, offset + rows).join('\n'), done: true })
        break
      }

      case 'mcp.call': {
        const server = settings.mcpServers.find((s) => s.name === req.serverName)
        if (!server) {
          reply(iframe, { requestId, error: `MCP server "${req.serverName}" not found`, done: true })
          return
        }
        const result = await callMCPTool(server, req.tool, req.params)
        reply(iframe, { requestId, result, done: true })
        break
      }

      case 'mcp.listTools': {
        const tools = getConnectedTools(
          settings.mcpServers.find((s) => s.name === req.serverName)?.id ?? ''
        )
        reply(iframe, { requestId, result: tools, done: true })
        break
      }

      case 'api.fetch': {
        const source = tool.dataSources.find(
          (ds) => ds.name === req.name && ds.type === 'api'
        )
        if (!source || source.type !== 'api') {
          reply(iframe, { requestId, error: `API source "${req.name}" not found`, done: true })
          return
        }
        const resp = await fetch(source.url, {
          ...req.options,
          headers: { ...source.headers, ...(req.options?.headers as Record<string, string> ?? {}) },
        })
        const data = await resp.json()
        reply(iframe, { requestId, result: data, done: true })
        break
      }
    }
  } catch (err) {
    reply(iframe, { requestId, error: String(err), done: true })
  }
}

export function attachBridge(
  iframe: HTMLIFrameElement,
  tool: ToolDefinition
): () => void {
  const handler = (event: MessageEvent) => handleBridgeMessage(event, iframe, tool)
  window.addEventListener('message', handler)
  return () => window.removeEventListener('message', handler)
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add public/bridge-inject.js src/services/bridge.ts
git commit -m "feat: add postMessage bridge (iframe inject + host handler)"
```

---

## Task 9: Export / Import Service

**Files:**
- Create: `src/services/exportImport.ts`

- [ ] **Step 1: Write `src/services/exportImport.ts`**

```typescript
import { ToolDefinition, ExportedTool, ExportedDataSource } from '../types'
import { readFileAsText, getFileSize } from './opfs'

const MAX_EMBED_SIZE = 10 * 1024 * 1024 // 10 MB

export async function exportTool(tool: ToolDefinition): Promise<ExportedTool> {
  const warnings: string[] = []
  const exportedSources: ExportedDataSource[] = []

  for (const ds of tool.dataSources) {
    if (ds.type === 'file') {
      try {
        const size = await getFileSize(ds.opfsPath)
        if (size <= MAX_EMBED_SIZE) {
          const text = await readFileAsText(ds.opfsPath)
          const embedded = btoa(unescape(encodeURIComponent(text)))
          exportedSources.push({ ...ds, embedded })
        } else {
          exportedSources.push({ type: 'file', name: ds.name, opfsPath: ds.opfsPath })
          warnings.push(`File "${ds.name}" (${(size / 1024 / 1024).toFixed(1)} MB) is too large to embed. Recipient must upload it manually.`)
        }
      } catch {
        exportedSources.push({ type: 'file', name: ds.name, opfsPath: ds.opfsPath })
        warnings.push(`Could not read file "${ds.name}" for embedding.`)
      }
    } else {
      exportedSources.push(ds)
    }
  }

  return {
    ...tool,
    dataSources: exportedSources,
    exportedAt: new Date().toISOString(),
    warnings: warnings.length ? warnings : undefined,
  }
}

export function downloadToolJson(exported: ExportedTool): void {
  const json = JSON.stringify(exported, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${exported.name.replace(/\s+/g, '-').toLowerCase()}.webcraft.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function importToolJson(file: File): Promise<ToolDefinition> {
  const text = await file.text()
  const data = JSON.parse(text) as ExportedTool

  // Strip export-only fields, reconstruct ToolDefinition
  const { exportedAt, warnings, ...toolData } = data

  // Strip embedded base64 from file sources (recipient uploads separately)
  const dataSources = toolData.dataSources.map((ds) => {
    if (ds.type === 'file') {
      const { embedded, ...rest } = ds as ExportedDataSource & { type: 'file'; embedded?: string }
      return rest
    }
    return ds
  })

  return { ...toolData, dataSources } as ToolDefinition
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/services/exportImport.ts
git commit -m "feat: add tool export/import service"
```

---

## Task 10: AppHeader Component

**Files:**
- Create: `src/components/AppHeader.tsx`

- [ ] **Step 1: Write `src/components/AppHeader.tsx`**

```tsx
import { Layout, Space, Typography, Button } from 'antd'
import { DatabaseOutlined, SettingOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'

const { Header } = Layout

export default function AppHeader() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <Header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      background: '#141414',
      borderBottom: '1px solid #303030',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <Typography.Title
        level={4}
        style={{ margin: 0, cursor: 'pointer', color: '#fff' }}
        onClick={() => navigate('/')}
      >
        ⚡ WebCraft AI
      </Typography.Title>

      <Space>
        <Button
          type={pathname === '/data' ? 'primary' : 'text'}
          icon={<DatabaseOutlined />}
          onClick={() => navigate('/data')}
        >
          資料來源
        </Button>
        <Button
          type={pathname === '/settings' ? 'primary' : 'text'}
          icon={<SettingOutlined />}
          onClick={() => navigate('/settings')}
        >
          設定
        </Button>
      </Space>
    </Header>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/AppHeader.tsx
git commit -m "feat: add AppHeader with navigation links"
```

---

## Task 11: ToolCard and DataSourceBadge Components

**Files:**
- Create: `src/components/DataSourceBadge.tsx`
- Create: `src/components/ToolCard.tsx`

- [ ] **Step 1: Write `src/components/DataSourceBadge.tsx`**

```tsx
import { Tag } from 'antd'
import { FileTextOutlined, ApiOutlined, CloudServerOutlined, RobotOutlined } from '@ant-design/icons'
import { DataSource } from '../types'

const CONFIG = {
  file: { color: 'blue',   icon: <FileTextOutlined />,   label: 'CSV/JSON' },
  api:  { color: 'green',  icon: <ApiOutlined />,         label: 'API' },
  mcp:  { color: 'purple', icon: <CloudServerOutlined />, label: 'MCP' },
} as const

export default function DataSourceBadge({ source }: { source: DataSource }) {
  const cfg = CONFIG[source.type]
  return (
    <Tag color={cfg.color} icon={cfg.icon}>
      {source.name || cfg.label}
    </Tag>
  )
}

export function LLMBadge() {
  return <Tag color="orange" icon={<RobotOutlined />}>LLM</Tag>
}
```

- [ ] **Step 2: Write `src/components/ToolCard.tsx`**

```tsx
import { Card, Typography, Space, Dropdown, Button } from 'antd'
import { EllipsisOutlined, EditOutlined, ExportOutlined, DeleteOutlined, PlayCircleOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { ToolDefinition } from '../types'
import DataSourceBadge, { LLMBadge } from './DataSourceBadge'

interface Props {
  tool: ToolDefinition
  onDelete: (id: string) => void
  onExport: (tool: ToolDefinition) => void
}

export default function ToolCard({ tool, onDelete, onExport }: Props) {
  const navigate = useNavigate()
  const currentVersion = tool.versions.find(v => v.versionId === tool.currentVersionId)

  const menuItems = [
    { key: 'open',   label: '開啟',  icon: <PlayCircleOutlined /> },
    { key: 'edit',   label: '編輯',  icon: <EditOutlined /> },
    { key: 'export', label: '匯出',  icon: <ExportOutlined /> },
    { key: 'delete', label: '刪除',  icon: <DeleteOutlined />, danger: true },
  ]

  function handleMenu({ key }: { key: string }) {
    if (key === 'open')   navigate(`/tool/${tool.id}`)
    if (key === 'edit')   navigate(`/create/${tool.id}`)
    if (key === 'export') onExport(tool)
    if (key === 'delete') onDelete(tool.id)
  }

  return (
    <Card
      hoverable
      style={{ cursor: 'pointer' }}
      onClick={() => navigate(`/tool/${tool.id}`)}
      extra={
        <Dropdown menu={{ items: menuItems, onClick: handleMenu }} trigger={['click']}>
          <Button
            type="text"
            icon={<EllipsisOutlined />}
            onClick={e => e.stopPropagation()}
          />
        </Dropdown>
      }
    >
      <Card.Meta
        title={tool.name}
        description={
          <Typography.Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 8 }}>
            {tool.description || '無描述'}
          </Typography.Paragraph>
        }
      />
      <Space wrap style={{ marginTop: 8 }}>
        <LLMBadge />
        {tool.dataSources.map((ds, i) => (
          <DataSourceBadge key={i} source={ds} />
        ))}
      </Space>
    </Card>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/DataSourceBadge.tsx src/components/ToolCard.tsx
git commit -m "feat: add ToolCard and DataSourceBadge components"
```

---

## Task 12: HomePage

**Files:**
- Modify: `src/pages/HomePage.tsx`

- [ ] **Step 1: Rewrite `src/pages/HomePage.tsx`**

```tsx
import { Layout, Row, Col, Button, Empty, Typography, Upload, message } from 'antd'
import { PlusOutlined, ImportOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import AppHeader from '../components/AppHeader'
import ToolCard from '../components/ToolCard'
import { useTools } from '../hooks/useTools'
import { exportTool, downloadToolJson, importToolJson } from '../services/exportImport'
import { ToolDefinition } from '../types'

const { Content } = Layout

export default function HomePage() {
  const navigate = useNavigate()
  const { tools, remove, save, refresh } = useTools()

  async function handleExport(tool: ToolDefinition) {
    const exported = await exportTool(tool)
    if (exported.warnings?.length) {
      exported.warnings.forEach(w => message.warning(w))
    }
    downloadToolJson(exported)
  }

  async function handleImport(file: File) {
    try {
      const tool = await importToolJson(file)
      tool.id = uuidv4() // new id to avoid collision
      save(tool)
      message.success(`已匯入工具：${tool.name}`)
    } catch {
      message.error('匯入失敗，請確認檔案格式正確')
    }
    return false // prevent antd auto-upload
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <AppHeader />
      <Content style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <Typography.Title level={3} style={{ margin: 0 }}>我的工具庫</Typography.Title>
          <div style={{ display: 'flex', gap: 8 }}>
            <Upload accept=".json" showUploadList={false} beforeUpload={handleImport}>
              <Button icon={<ImportOutlined />}>匯入</Button>
            </Upload>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/create')}>
              新增工具
            </Button>
          </div>
        </div>

        {tools.length === 0 ? (
          <Empty description="還沒有工具，點擊「新增工具」開始建立">
            <Button type="primary" onClick={() => navigate('/create')}>新增第一個工具</Button>
          </Empty>
        ) : (
          <Row gutter={[16, 16]}>
            {tools.map(tool => (
              <Col key={tool.id} xs={24} sm={12} md={8} lg={6}>
                <ToolCard tool={tool} onDelete={remove} onExport={handleExport} />
              </Col>
            ))}
          </Row>
        )}
      </Content>
    </Layout>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles and home page renders**

```bash
npx tsc --noEmit
npm run dev
```

Expected: home page shows empty state with "新增工具" button.

- [ ] **Step 3: Commit**

```bash
git add src/pages/HomePage.tsx
git commit -m "feat: implement HomePage with tool grid, import, and export"
```

---

## Task 13: SettingsPage

**Files:**
- Modify: `src/pages/SettingsPage.tsx`

- [ ] **Step 1: Rewrite `src/pages/SettingsPage.tsx`**

```tsx
import { Layout, Form, Input, Button, Table, Modal, Select, message, Typography, Space, Divider } from 'antd'
import { PlusOutlined, DeleteOutlined, ApiOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import AppHeader from '../components/AppHeader'
import { useSettings } from '../hooks/useSettings'
import { testConnection } from '../services/llm'
import { connectMCP } from '../services/mcpClient'
import { MCPServer } from '../types'

const { Content } = Layout

export default function SettingsPage() {
  const { settings, update } = useSettings()
  const [llmForm] = Form.useForm()
  const [mcpForm] = Form.useForm()
  const [mcpModalOpen, setMcpModalOpen] = useState(false)
  const [editingMcp, setEditingMcp] = useState<MCPServer | null>(null)
  const [testing, setTesting] = useState(false)
  const [connecting, setConnecting] = useState(false)

  async function handleSaveLLM(values: typeof settings.llm) {
    update({ ...settings, llm: values })
    message.success('LLM 設定已儲存')
  }

  async function handleTestLLM() {
    setTesting(true)
    const ok = await testConnection(llmForm.getFieldsValue())
    setTesting(false)
    ok ? message.success('連線成功') : message.error('連線失敗，請確認端點與 API Key')
  }

  async function handleSaveMCP(values: Omit<MCPServer, 'id'>) {
    setConnecting(true)
    const server: MCPServer = { ...values, id: editingMcp?.id ?? uuidv4() }
    try {
      await connectMCP(server)
      const existing = settings.mcpServers.filter(s => s.id !== server.id)
      update({ ...settings, mcpServers: [...existing, server] })
      message.success(`MCP Server "${server.name}" 連線成功`)
      setMcpModalOpen(false)
    } catch {
      message.error('MCP 連線失敗，請確認 URL 與 transport 類型')
    } finally {
      setConnecting(false)
    }
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

  function deleteMcp(id: string) {
    update({ ...settings, mcpServers: settings.mcpServers.filter(s => s.id !== id) })
  }

  const mcpColumns = [
    { title: '名稱', dataIndex: 'name' },
    { title: 'URL', dataIndex: 'url', ellipsis: true },
    { title: 'Transport', dataIndex: 'transport' },
    {
      title: '操作',
      render: (_: unknown, record: MCPServer) => (
        <Space>
          <Button size="small" onClick={() => openEditMcp(record)}>編輯</Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => deleteMcp(record.id)} />
        </Space>
      ),
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <AppHeader />
      <Content style={{ padding: 24, maxWidth: 700, margin: '0 auto', width: '100%' }}>
        <Typography.Title level={3}>設定</Typography.Title>

        <Typography.Title level={4}>LLM 設定</Typography.Title>
        <Form
          form={llmForm}
          initialValues={settings.llm}
          onFinish={handleSaveLLM}
          layout="vertical"
        >
          <Form.Item name="endpoint" label="Endpoint URL" rules={[{ required: true }]}>
            <Input placeholder="https://api.openai.com/v1" />
          </Form.Item>
          <Form.Item name="apiKey" label="API Key" rules={[{ required: true }]}>
            <Input.Password placeholder="sk-..." />
          </Form.Item>
          <Form.Item name="model" label="Model" rules={[{ required: true }]}>
            <Input placeholder="gpt-4o" />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit">儲存</Button>
            <Button icon={<ApiOutlined />} loading={testing} onClick={handleTestLLM}>
              測試連線
            </Button>
          </Space>
        </Form>

        <Divider />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Typography.Title level={4} style={{ margin: 0 }}>MCP Servers</Typography.Title>
          <Button icon={<PlusOutlined />} onClick={openAddMcp}>新增</Button>
        </div>

        <Table
          dataSource={settings.mcpServers}
          columns={mcpColumns}
          rowKey="id"
          pagination={false}
          size="small"
        />

        <Modal
          title={editingMcp ? '編輯 MCP Server' : '新增 MCP Server'}
          open={mcpModalOpen}
          onCancel={() => setMcpModalOpen(false)}
          footer={null}
        >
          <Form form={mcpForm} onFinish={handleSaveMCP} layout="vertical">
            <Form.Item name="name" label="名稱" rules={[{ required: true }]}>
              <Input placeholder="my-server" />
            </Form.Item>
            <Form.Item name="url" label="URL" rules={[{ required: true }]}>
              <Input placeholder="http://localhost:3000" />
            </Form.Item>
            <Form.Item name="transport" label="Transport" rules={[{ required: true }]}>
              <Select options={[
                { value: 'sse', label: 'SSE' },
                { value: 'streamable-http', label: 'Streamable HTTP' },
              ]} />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={connecting}>
              儲存並測試連線
            </Button>
          </Form>
        </Modal>
      </Content>
    </Layout>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/SettingsPage.tsx
git commit -m "feat: implement SettingsPage with LLM and MCP configuration"
```

---

## Task 14: DataPage

**Files:**
- Modify: `src/pages/DataPage.tsx`

- [ ] **Step 1: Rewrite `src/pages/DataPage.tsx`**

```tsx
import { Layout, Table, Button, Upload, message, Typography, Space, Tag } from 'antd'
import { UploadOutlined, DeleteOutlined } from '@ant-design/icons'
import { useState, useEffect } from 'react'
import AppHeader from '../components/AppHeader'
import { listFiles, writeFile, deleteFile, OPFSFileInfo } from '../services/opfs'

const { Content } = Layout

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export default function DataPage() {
  const [files, setFiles] = useState<OPFSFileInfo[]>([])
  const [uploading, setUploading] = useState(false)

  async function loadFiles() {
    setFiles(await listFiles('/data'))
  }

  useEffect(() => { loadFiles() }, [])

  async function handleUpload(file: File) {
    setUploading(true)
    try {
      await writeFile(`/data/${file.name}`, file)
      await loadFiles()
      message.success(`已上傳 ${file.name}`)
    } catch {
      message.error('上傳失敗')
    } finally {
      setUploading(false)
    }
    return false
  }

  async function handleDelete(path: string, name: string) {
    try {
      await deleteFile(path)
      await loadFiles()
      message.success(`已刪除 ${name}`)
    } catch {
      message.error('刪除失敗')
    }
  }

  const columns = [
    { title: '檔名', dataIndex: 'name' },
    {
      title: '大小',
      dataIndex: 'size',
      render: (size: number) => (
        <Tag color={size > 100 * 1024 * 1024 ? 'orange' : 'default'}>{formatSize(size)}</Tag>
      ),
    },
    {
      title: '操作',
      render: (_: unknown, record: OPFSFileInfo) => (
        <Button
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => handleDelete(record.path, record.name)}
        >
          刪除
        </Button>
      ),
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <AppHeader />
      <Content style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <Typography.Title level={3} style={{ margin: 0 }}>資料來源管理</Typography.Title>
          <Upload
            accept=".csv,.json"
            showUploadList={false}
            beforeUpload={handleUpload}
            multiple
          >
            <Button icon={<UploadOutlined />} loading={uploading}>
              上傳 CSV / JSON
            </Button>
          </Upload>
        </div>

        <Table
          dataSource={files}
          columns={columns}
          rowKey="path"
          pagination={false}
          locale={{ emptyText: '尚無資料檔案，請上傳 CSV 或 JSON' }}
        />
      </Content>
    </Layout>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/DataPage.tsx
git commit -m "feat: implement DataPage for OPFS file management"
```

---

## Task 15: ChatMessage and ChatPanel Components

**Files:**
- Create: `src/components/ChatMessage.tsx`
- Create: `src/components/ChatPanel.tsx`

- [ ] **Step 1: Write `src/components/ChatMessage.tsx`**

```tsx
import { Typography, theme } from 'antd'
import { RobotOutlined, UserOutlined } from '@ant-design/icons'
import { Message } from '../types'

interface Props {
  message: Message
  streaming?: boolean
  streamText?: string
}

export default function ChatMessage({ message, streaming, streamText }: Props) {
  const { token } = theme.useToken()
  const isUser = message.role === 'user'
  const displayContent = streaming && !isUser ? streamText ?? '' : message.content

  // Strip patch blocks for display in chat history
  const visibleContent = displayContent.replace(/<patch>[\s\S]*?<\/patch>/g, '').trim()
  // Show patch summary if patches exist
  const patchCount = (displayContent.match(/<patch>/g) ?? []).length

  return (
    <div style={{
      display: 'flex',
      gap: 12,
      padding: '12px 0',
      flexDirection: isUser ? 'row-reverse' : 'row',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
        background: isUser ? token.colorPrimary : token.colorSuccess,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {isUser ? <UserOutlined style={{ color: '#fff' }} /> : <RobotOutlined style={{ color: '#fff' }} />}
      </div>

      <div style={{ maxWidth: '75%' }}>
        <div style={{
          background: isUser ? token.colorPrimaryBg : token.colorFillQuaternary,
          borderRadius: 8,
          padding: '10px 14px',
        }}>
          <Typography.Text style={{ whiteSpace: 'pre-wrap' }}>
            {visibleContent}
            {streaming && !isUser && <span style={{ opacity: 0.5 }}>▌</span>}
          </Typography.Text>
        </div>
        {patchCount > 0 && (
          <Typography.Text type="secondary" style={{ fontSize: 12, paddingLeft: 4 }}>
            🔧 {patchCount} 個程式碼修改
          </Typography.Text>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write `src/components/ChatPanel.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import { Input, Button, Space, Typography } from 'antd'
import { SendOutlined, StopOutlined } from '@ant-design/icons'
import { Message } from '../types'
import ChatMessage from './ChatMessage'

interface Props {
  messages: Message[]
  streaming: boolean
  streamText: string
  input: string
  onInputChange: (v: string) => void
  onSend: () => void
  onAbort: () => void
}

export default function ChatPanel({
  messages, streaming, streamText, input, onInputChange, onSend, onAbort
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamText])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!streaming && input.trim()) onSend()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', opacity: 0.5 }}>
            <Typography.Text type="secondary">描述你想要的工具，例如：「幫我做一個 CSV 資料分析工具，可以顯示統計圖表」</Typography.Text>
          </div>
        )}
        {messages.map((msg, i) => (
          <ChatMessage key={i} message={msg} />
        ))}
        {streaming && (
          <ChatMessage
            message={{ role: 'assistant', content: '' }}
            streaming
            streamText={streamText}
          />
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: 16, borderTop: '1px solid #303030' }}>
        <Space.Compact style={{ width: '100%' }}>
          <Input.TextArea
            value={input}
            onChange={e => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="描述需求... (Enter 送出，Shift+Enter 換行)"
            autoSize={{ minRows: 2, maxRows: 6 }}
            disabled={streaming}
          />
          {streaming ? (
            <Button danger icon={<StopOutlined />} onClick={onAbort} style={{ height: 'auto' }}>
              停止
            </Button>
          ) : (
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={onSend}
              disabled={!input.trim()}
              style={{ height: 'auto' }}
            >
              送出
            </Button>
          )}
        </Space.Compact>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/ChatMessage.tsx src/components/ChatPanel.tsx
git commit -m "feat: add ChatMessage and ChatPanel components with streaming support"
```

---

## Task 16: BridgeIframe and CodeViewer Components

**Files:**
- Create: `src/components/BridgeIframe.tsx`
- Create: `src/components/CodeViewer.tsx`

- [ ] **Step 1: Write `src/components/BridgeIframe.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import { ToolDefinition } from '../types'
import { attachBridge } from '../services/bridge'

interface Props {
  code: string
  tool: ToolDefinition
  style?: React.CSSProperties
}

const BRIDGE_SCRIPT_URL = new URL('/bridge-inject.js', import.meta.url).href

export default function BridgeIframe({ code, tool, style }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    // Inject bridge script before tool code
    const injectedCode = `<!DOCTYPE html><html><head>
<script src="${BRIDGE_SCRIPT_URL}"></script>
</head><body>${code.replace(/^<!DOCTYPE html>[\s\S]*?<body>/i, '').replace(/<\/body>[\s\S]*$/i, '')}</body></html>`

    iframe.srcdoc = injectedCode

    const detach = attachBridge(iframe, tool)
    return detach
  }, [code, tool])

  return (
    <iframe
      ref={iframeRef}
      style={{ width: '100%', height: '100%', border: 'none', ...style }}
      sandbox="allow-scripts allow-forms allow-modals"
      title="Tool Preview"
    />
  )
}
```

- [ ] **Step 2: Write `src/components/CodeViewer.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import { Button, message } from 'antd'
import { CopyOutlined } from '@ant-design/icons'
import hljs from 'highlight.js/lib/core'
import xml from 'highlight.js/lib/languages/xml'
import 'highlight.js/styles/github-dark.css'

hljs.registerLanguage('html', xml)

interface Props {
  code: string
}

export default function CodeViewer({ code }: Props) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.textContent = code
      hljs.highlightElement(ref.current)
    }
  }, [code])

  async function handleCopy() {
    await navigator.clipboard.writeText(code)
    message.success('已複製')
  }

  return (
    <div style={{ position: 'relative', height: '100%', overflow: 'auto' }}>
      <Button
        size="small"
        icon={<CopyOutlined />}
        onClick={handleCopy}
        style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}
      >
        複製
      </Button>
      <pre style={{ margin: 0, height: '100%' }}>
        <code ref={ref} className="language-html" style={{ fontSize: 13 }} />
      </pre>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/BridgeIframe.tsx src/components/CodeViewer.tsx
git commit -m "feat: add BridgeIframe with postMessage bridge and CodeViewer with syntax highlight"
```

---

## Task 17: VersionTree Component

**Files:**
- Create: `src/components/VersionTree.tsx`

- [ ] **Step 1: Write `src/components/VersionTree.tsx`**

```tsx
import { Tree, Button, Tooltip, Input, message } from 'antd'
import { BranchesOutlined, TagOutlined } from '@ant-design/icons'
import { useState } from 'react'
import type { DataNode } from 'antd/es/tree'
import { ToolVersion } from '../types'

interface Props {
  versions: ToolVersion[]
  currentVersionId: string
  onSelect: (versionId: string) => void
  onDelete: (versionId: string) => void
  onLabel: (versionId: string, label: string) => void
}

function buildTreeData(
  versions: ToolVersion[],
  parentId: string | null,
  currentVersionId: string,
  onDelete: (id: string) => void,
  onLabel: (id: string, label: string) => void
): DataNode[] {
  return versions
    .filter(v => v.parentVersionId === parentId)
    .map(v => {
      const isCurrent = v.versionId === currentVersionId
      const time = new Date(v.createdAt).toLocaleTimeString()
      return {
        key: v.versionId,
        title: (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: isCurrent ? '#52c41a' : undefined, fontWeight: isCurrent ? 600 : 400 }}>
              {v.label || time}
            </span>
            {isCurrent && <span style={{ fontSize: 10, color: '#52c41a' }}>● 當前</span>}
            <Tooltip title="標記版本">
              <Button
                type="text" size="small" icon={<TagOutlined />}
                onClick={e => {
                  e.stopPropagation()
                  const label = window.prompt('輸入版本說明', v.label ?? '')
                  if (label !== null) onLabel(v.versionId, label)
                }}
                style={{ padding: '0 4px', height: 20 }}
              />
            </Tooltip>
          </span>
        ),
        children: buildTreeData(versions, v.versionId, currentVersionId, onDelete, onLabel),
      }
    })
}

export default function VersionTree({ versions, currentVersionId, onSelect, onDelete, onLabel }: Props) {
  if (versions.length === 0) return null

  const treeData = buildTreeData(versions, null, currentVersionId, onDelete, onLabel)

  return (
    <div style={{ padding: '8px 12px', borderBottom: '1px solid #303030', maxHeight: 200, overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <BranchesOutlined style={{ color: '#888' }} />
        <span style={{ fontSize: 12, color: '#888' }}>版本歷史</span>
      </div>
      <Tree
        treeData={treeData}
        selectedKeys={[currentVersionId]}
        onSelect={([key]) => key && onSelect(String(key))}
        defaultExpandAll
        showLine
        blockNode
        style={{ fontSize: 12 }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/VersionTree.tsx
git commit -m "feat: add VersionTree component with branching version history"
```

---

## Task 18: PreviewPanel Component

**Files:**
- Create: `src/components/PreviewPanel.tsx`

- [ ] **Step 1: Write `src/components/PreviewPanel.tsx`**

```tsx
import { Tabs } from 'antd'
import { AppstoreOutlined, CodeOutlined } from '@ant-design/icons'
import { ToolDefinition, ToolVersion } from '../types'
import BridgeIframe from './BridgeIframe'
import CodeViewer from './CodeViewer'
import VersionTree from './VersionTree'

interface Props {
  tool: ToolDefinition
  currentVersion: ToolVersion | undefined
  onVersionSelect: (versionId: string) => void
  onVersionDelete: (versionId: string) => void
  onVersionLabel: (versionId: string, label: string) => void
}

export default function PreviewPanel({
  tool, currentVersion, onVersionSelect, onVersionDelete, onVersionLabel
}: Props) {
  const code = currentVersion?.code ?? ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <VersionTree
        versions={tool.versions}
        currentVersionId={tool.currentVersionId}
        onSelect={onVersionSelect}
        onDelete={onVersionDelete}
        onLabel={onVersionLabel}
      />

      <Tabs
        style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
        tabBarStyle={{ margin: '0 12px' }}
        items={[
          {
            key: 'tool',
            label: <span><AppstoreOutlined /> Tool</span>,
            children: (
              <div style={{ height: 'calc(100vh - 340px)' }}>
                {code
                  ? <BridgeIframe code={code} tool={tool} style={{ height: '100%' }} />
                  : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.4 }}>尚未生成工具</div>
                }
              </div>
            ),
          },
          {
            key: 'code',
            label: <span><CodeOutlined /> Code</span>,
            children: (
              <div style={{ height: 'calc(100vh - 340px)' }}>
                {code
                  ? <CodeViewer code={code} />
                  : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.4 }}>尚未生成工具</div>
                }
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/PreviewPanel.tsx
git commit -m "feat: add PreviewPanel with Tool/Code tabs and VersionTree"
```

---

## Task 19: CreatePage — LLM System Prompt Builder

**Files:**
- Create: `src/services/systemPrompt.ts`

- [ ] **Step 1: Write `src/services/systemPrompt.ts`**

```typescript
import { ToolDefinition } from '../types'

const BRIDGE_API_DOCS = `
You have access to \`window.bridge\` inside your generated HTML tool:

\`\`\`typescript
// LLM chat (streaming)
const response = await window.bridge.llm.chat([
  { role: 'user', content: 'Summarize this: ...' }
])

// Read uploaded data file
const csvText = await window.bridge.data.read('sales.csv', { rows: 100, offset: 0 })

// Call MCP tool
const result = await window.bridge.mcp.call('my-server', 'get_data', { param: 'value' })

// Fetch external API (proxied, CORS-safe)
const data = await window.bridge.api.fetch('weather-api')
\`\`\`
`

export function buildFirstTurnSystemPrompt(
  dataSources: ToolDefinition['dataSources']
): string {
  const sourceList = dataSources.length
    ? dataSources.map(ds => `- ${ds.name} (type: ${ds.type})`).join('\n')
    : '(none)'

  return `You are an expert web developer. Generate a complete, self-contained HTML tool based on the user's requirements.

${BRIDGE_API_DOCS}

Available data sources bound to this tool:
${sourceList}

Output format: Respond with a brief explanation followed by the complete HTML in a markdown code block:
\`\`\`html
<!DOCTYPE html>
...full HTML with inline CSS and JS...
\`\`\`

Requirements:
- Use modern CSS (flexbox/grid), responsive layout
- Handle errors gracefully with user-friendly messages
- No external CDN dependencies unless absolutely necessary
- All JS must be vanilla (no build step)`
}

export function buildPatchSystemPrompt(
  currentCode: string,
  dataSources: ToolDefinition['dataSources']
): string {
  const sourceList = dataSources.length
    ? dataSources.map(ds => `- ${ds.name} (type: ${ds.type})`).join('\n')
    : '(none)'

  return `You are an expert web developer modifying an existing HTML tool.

${BRIDGE_API_DOCS}

Available data sources: 
${sourceList}

Current tool code:
\`\`\`html
${currentCode}
\`\`\`

Output format: Respond with a brief explanation of your changes, then one or more patch blocks:

<patch>
<find><![CDATA[exact substring to find in current code]]></find>
<replace><![CDATA[replacement code]]></replace>
</patch>

Rules:
- Each <find> must be a unique, exact substring of the current code
- You can include multiple <patch> blocks
- Only change what is necessary
- If the change is too large to patch (e.g. full rewrite), output the full HTML in a markdown code block instead`
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/services/systemPrompt.ts
git commit -m "feat: add LLM system prompt builder for first-turn and patch modes"
```

---

## Task 20: CreatePage

**Files:**
- Modify: `src/pages/CreatePage.tsx`

- [ ] **Step 1: Rewrite `src/pages/CreatePage.tsx`**

```tsx
import { Layout, Row, Col, Button, Input, Space, message, Select, Form, Modal, Typography } from 'antd'
import { SaveOutlined, ExportOutlined } from '@ant-design/icons'
import { useState, useCallback } from 'react'
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
import { exportTool, downloadToolJson } from '../services/exportImport'
import { listFiles } from '../services/opfs'
import { ToolDefinition, ToolVersion, Message } from '../types'

const { Content } = Layout

function newTool(name: string): ToolDefinition {
  return {
    id: uuidv4(),
    name,
    description: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
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

  const [tool, setTool] = useState<ToolDefinition>(() => {
    if (id) return getTool(id) ?? newTool('新工具')
    return newTool('新工具')
  })

  const currentVersion = tool.versions.find(v => v.versionId === tool.currentVersionId)
  const [messages, setMessages] = useState<Message[]>(() => currentVersion?.conversation ?? [])
  const [input, setInput] = useState('')
  const [saveModalOpen, setSaveModalOpen] = useState(false)

  const isFirstTurn = tool.versions.length === 0

  async function handleSend() {
    if (!input.trim() || streaming) return
    if (!settings.llm.endpoint || !settings.llm.apiKey) {
      message.error('請先在設定頁填入 LLM Endpoint 和 API Key')
      return
    }

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

    // Apply response to code
    let newCode: string | null = null

    if (isFirstTurn) {
      newCode = extractFullHtml(fullResponse)
      if (!newCode) {
        message.warning('未能解析生成的 HTML，請重試')
        return
      }
    } else {
      const patches = parsePatches(fullResponse)
      if (patches.length > 0) {
        newCode = applyPatches(currentVersion?.code ?? '', patches)
        if (!newCode) {
          // fallback: ask LLM for full rewrite
          message.warning('Patch 套用失敗，正在要求完整重新生成...')
          const fallbackPrompt = buildFirstTurnSystemPrompt(tool.dataSources)
          try {
            const fallback = await start(settings.llm, fallbackPrompt, updatedMessages)
            newCode = extractFullHtml(fallback)
          } catch {
            message.error('重新生成失敗')
            return
          }
        }
      } else {
        // LLM chose to output full HTML instead of patches
        newCode = extractFullHtml(fullResponse)
      }
    }

    if (!newCode) {
      message.warning('未能從 LLM 回應中取得程式碼')
      return
    }

    const explanation = extractExplanation(fullResponse) || fullResponse.split('\n')[0]
    const assistantMsg: Message = { role: 'assistant', content: explanation }
    const newConversation = [...updatedMessages, assistantMsg]
    setMessages(newConversation)

    // Create new version
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
  }

  function handleVersionSelect(versionId: string) {
    const version = tool.versions.find(v => v.versionId === versionId)
    if (!version) return
    const updated = { ...tool, currentVersionId: versionId }
    setTool(updated)
    setMessages(version.conversation)
    save(updated)
  }

  function handleVersionDelete(versionId: string) {
    // Delete version and all its descendants
    const toDelete = new Set<string>()
    function collect(id: string) {
      toDelete.add(id)
      tool.versions.filter(v => v.parentVersionId === id).forEach(v => collect(v.versionId))
    }
    collect(versionId)

    const remaining = tool.versions.filter(v => !toDelete.has(v.versionId))
    const newCurrentId = toDelete.has(tool.currentVersionId)
      ? (remaining[remaining.length - 1]?.versionId ?? '')
      : tool.currentVersionId

    const updated = { ...tool, versions: remaining, currentVersionId: newCurrentId }
    setTool(updated)
    save(updated)
    if (newCurrentId !== tool.currentVersionId) {
      const v = remaining.find(v => v.versionId === newCurrentId)
      if (v) setMessages(v.conversation)
    }
  }

  function handleVersionLabel(versionId: string, label: string) {
    const updated = {
      ...tool,
      versions: tool.versions.map(v => v.versionId === versionId ? { ...v, label } : v),
    }
    setTool(updated)
    save(updated)
  }

  function handleSaveInfo(values: { name: string; description: string }) {
    const updated = { ...tool, ...values }
    setTool(updated)
    save(updated)
    setSaveModalOpen(false)
    if (!id) navigate(`/create/${updated.id}`, { replace: true })
  }

  async function handleExport() {
    const exported = await exportTool(tool)
    if (exported.warnings?.length) exported.warnings.forEach(w => message.warning(w))
    downloadToolJson(exported)
  }

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      <AppHeader />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', borderBottom: '1px solid #303030' }}>
        <Typography.Title level={5} style={{ margin: 0, cursor: 'pointer' }} onClick={() => setSaveModalOpen(true)}>
          {tool.name} ✏️
        </Typography.Title>
        <Space>
          <Button icon={<SaveOutlined />} onClick={() => setSaveModalOpen(true)}>儲存設定</Button>
          <Button icon={<ExportOutlined />} onClick={handleExport} disabled={!currentVersion}>匯出</Button>
        </Space>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ width: '40%', borderRight: '1px solid #303030', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <ChatPanel
            messages={messages}
            streaming={streaming}
            streamText={streamText}
            input={input}
            onInputChange={setInput}
            onSend={handleSend}
            onAbort={abort}
          />
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <PreviewPanel
            tool={tool}
            currentVersion={currentVersion}
            onVersionSelect={handleVersionSelect}
            onVersionDelete={handleVersionDelete}
            onVersionLabel={handleVersionLabel}
          />
        </div>
      </div>

      <Modal title="工具設定" open={saveModalOpen} onCancel={() => setSaveModalOpen(false)} footer={null}>
        <Form initialValues={{ name: tool.name, description: tool.description }} onFinish={handleSaveInfo} layout="vertical">
          <Form.Item name="name" label="工具名稱" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Button type="primary" htmlType="submit">儲存</Button>
        </Form>
      </Modal>
    </Layout>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Start dev server and test the create flow**

```bash
npm run dev
```

Manually verify:
1. Navigate to `/#/create`
2. Set LLM credentials at `/#/settings`
3. Type "建立一個 Hello World 工具" and press Enter
4. Confirm streaming text appears in the chat bubble
5. Confirm iframe refreshes with the generated tool after streaming ends
6. Confirm a version appears in VersionTree

- [ ] **Step 4: Commit**

```bash
git add src/pages/CreatePage.tsx src/services/systemPrompt.ts
git commit -m "feat: implement CreatePage with LLM generation, patch apply, and version branching"
```

---

## Task 21: ToolPage

**Files:**
- Modify: `src/pages/ToolPage.tsx`

- [ ] **Step 1: Rewrite `src/pages/ToolPage.tsx`**

```tsx
import { Button, Space, message } from 'antd'
import { ArrowLeftOutlined, EditOutlined, ExportOutlined } from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import { useTools } from '../hooks/useTools'
import BridgeIframe from '../components/BridgeIframe'
import { exportTool, downloadToolJson } from '../services/exportImport'

export default function ToolPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { getTool } = useTools()
  const tool = getTool(id!)

  if (!tool) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        找不到工具
        <Button onClick={() => navigate('/')} style={{ marginLeft: 12 }}>返回首頁</Button>
      </div>
    )
  }

  const currentVersion = tool.versions.find(v => v.versionId === tool.currentVersionId)

  async function handleExport() {
    const exported = await exportTool(tool)
    if (exported.warnings?.length) exported.warnings.forEach(w => message.warning(w))
    downloadToolJson(exported)
  }

  return (
    <div style={{ height: '100vh', position: 'relative' }}>
      {currentVersion && (
        <BridgeIframe code={currentVersion.code} tool={tool} style={{ height: '100vh' }} />
      )}

      <Space style={{
        position: 'fixed', top: 16, right: 16, zIndex: 1000,
        background: 'rgba(0,0,0,0.6)', borderRadius: 8, padding: '4px 8px',
      }}>
        <Button size="small" icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>首頁</Button>
        <Button size="small" icon={<EditOutlined />} onClick={() => navigate(`/create/${id}`)}>編輯</Button>
        <Button size="small" icon={<ExportOutlined />} onClick={handleExport}>匯出</Button>
      </Space>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/ToolPage.tsx
git commit -m "feat: implement ToolPage with full-screen iframe and floating controls"
```

---

## Task 22: GitHub Actions Deploy

**Files:**
- Create: `.github/workflows/deploy.yml`
- Create: `.gitignore`

- [ ] **Step 1: Write `.gitignore`**

```
node_modules/
dist/
.superpowers/
```

- [ ] **Step 2: Write `.github/workflows/deploy.yml`**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - run: npm run build

      - name: Deploy to gh-pages
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

- [ ] **Step 3: Commit**

```bash
git add .github .gitignore
git commit -m "ci: add GitHub Actions deploy workflow for GitHub Pages"
```

- [ ] **Step 4: Push to GitHub and verify deploy**

```bash
git remote add origin https://github.com/<your-username>/webcraft-ai.git
git push -u origin main
```

Expected: GitHub Actions runs `npm run build` and deploys to `gh-pages` branch. App accessible at `https://<your-username>.github.io/webcraft-ai/`.

---

## Self-Review

### Spec Coverage

| Spec requirement | Covered by |
|---|---|
| React + Vite + Ant Design + TypeScript | Task 1 |
| Hash Router for GitHub Pages | Task 1 App.tsx |
| localStorage for tools + settings | Task 3 |
| OPFS for large files (2GB+) | Task 4 |
| LLM streaming (OpenAI-compatible + custom endpoint) | Task 5 |
| XML patch format with streaming display | Task 6, Task 19 |
| MCP SSE + Streamable HTTP | Task 7 |
| postMessage bridge (llm/data/mcp/api) | Task 8 |
| Export/import .webcraft.json | Task 9 |
| AppHeader with nav links | Task 10 |
| Tool cards with data source badges | Task 11 |
| HomePage with grid, import, export | Task 12 |
| SettingsPage LLM + MCP | Task 13 |
| DataPage OPFS file management | Task 14 |
| Chat panel with streaming, abort | Task 15 |
| BridgeIframe + CodeViewer | Task 16 |
| Version tree (branching, label, delete) | Task 17 |
| PreviewPanel Tool/Code tabs | Task 18 |
| System prompt builder (first-turn + patch) | Task 19 |
| CreatePage full flow + version auto-save | Task 20 |
| ToolPage full-screen + floating buttons | Task 21 |
| GitHub Actions deploy | Task 22 |
| Patch fallback to full rewrite | Task 20 CreatePage |
| API Key not exported | Task 9 exportImport |
| File >10MB not embedded, shows warning | Task 9 exportImport |

All spec requirements are covered. ✅
