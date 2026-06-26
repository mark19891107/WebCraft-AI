# WebCraft AI — 設計規格

**日期：** 2026-06-26  
**狀態：** 已核准

## 概述

WebCraft AI 是一個純前端的 AI 網頁工具生成平台，讓用戶透過對話描述需求，由 LLM 生成可互動的網頁工具。工具可綁定外部資料來源（CSV/JSON 檔案、API、MCP Server），生成後可儲存在瀏覽器本地，並透過匯出 JSON 定義檔的方式分享給他人。整個系統部署在 GitHub Pages，不需要後端伺服器。

## 目標用戶

- **一般用戶**：無需技術背景，透過自然語言描述需求即可生成工具
- **開發者**：可檢視/編輯生成的 HTML/JS 原始碼，進行進階客製化

## 技術棧

- **框架：** React 18 + Vite
- **UI 元件：** Ant Design
- **路由：** React Router v6（Hash Router，相容 GitHub Pages 靜態部署）
- **儲存：** localStorage（工具定義、設定）+ OPFS（大型資料檔案，支援 2GB+）
- **部署：** GitHub Pages + GitHub Actions（push to main 自動部署）
- **語言：** TypeScript

## 頁面結構

### `/` — 首頁（工具庫）

- **Header**：系統名稱 WebCraft AI + 導航連結（資料來源、LLM 設定、MCP 設定）
- **Body**：工具卡片網格，每張卡片顯示工具名稱、描述、資料來源 badge（CSV / API / MCP / LLM）
- **操作**：新增工具按鈕、匯入 JSON 定義檔按鈕、卡片右鍵選單（開啟 / 編輯 / 匯出 / 刪除）

### `/create` — 建立工具

- **左側**：對話介面，用戶描述需求，LLM streaming 回應並生成程式碼，可來回修改
- **右側**：預覽區，頂部有 **Tool / Code 切換 Tab**（Ant Design Tabs）
  - **Tool View**：iframe 全畫面渲染工具，patch 套用後自動刷新
  - **Code View**：語法高亮的程式碼閱覽器（唯讀，使用 highlight.js 或 Prism），顯示當前版本完整 HTML；提供複製按鈕
  - 版本歷史時間軸位於右側預覽區頂部 Tab 列下方
- **底部操作列**：儲存工具名稱/描述、選擇綁定的資料來源
- 對話紀錄隨工具定義一起儲存，之後可繼續修改

### `/tool/:id` — 使用工具

- 全頁顯示工具（iframe 全畫面）
- 右上角浮動按鈕：返回首頁 / 編輯（回到 /create）/ 匯出 JSON

### `/data` — 資料來源管理

- 上傳 CSV / JSON 檔案（存入 OPFS，支援 2GB+）
- 管理已上傳的檔案（查看大小、刪除）

### `/settings` — 系統設定

- **LLM 設定**：Endpoint URL（支援 OpenAI-compatible API）、API Key、預設 Model 名稱、測試連線按鈕
- **MCP Server 清單**：新增 / 編輯 / 刪除 MCP Server，每個 Server 設定 Name、URL、Transport 類型（`sse` 或 `streamable-http`）

## 資料結構

### 工具定義（localStorage）

```typescript
interface ToolDefinition {
  id: string               // UUID v4
  name: string
  description: string
  createdAt: string        // ISO 8601
  updatedAt: string
  currentVersionId: string // 當前顯示的版本 ID
  versions: ToolVersion[]  // 所有版本（樹狀，透過 parentVersionId 連結）
  dataSources: DataSource[]
  conversation: Message[]  // 建立時的對話紀錄
}

interface ToolVersion {
  versionId: string        // UUID v4
  parentVersionId: string | null  // 形成樹狀結構，null 代表根版本
  createdAt: string        // ISO 8601
  label?: string           // 用戶自訂版本說明（可選）
  code: string             // 該版本的完整 HTML 程式碼（snapshot）
  conversation: Message[]  // 該版本對應的對話紀錄（從此分支起點開始）
}

type DataSource =
  | { type: 'file'; name: string; opfsPath: string }
  | { type: 'api';  name: string; url: string; headers: Record<string, string> }
  | { type: 'mcp';  name: string; serverRef: string }  // serverRef 指向 Settings.mcpServers[].id

interface Message {
  role: 'user' | 'assistant'
  content: string
}
```

### 系統設定（localStorage，獨立 key）

```typescript
interface Settings {
  llm: {
    endpoint: string
    apiKey: string
    model: string
  }
  mcpServers: MCPServer[]
}

interface MCPServer {
  id: string
  name: string
  url: string
  transport: 'sse' | 'streamable-http'
}
```

### 匯出格式（JSON 定義檔）

與 `ToolDefinition` 相同結構，但：
- `dataSources[type=file]` 的小型檔案（< 10MB）嵌入 base64；大型檔案省略並附警告
- `dataSources[type=api/mcp]` 保留設定，接收方需自行有對應的 server
- API Key 不會被匯出

## Bridge API（iframe ↔ 主頁面通訊）

生成的工具程式碼透過 `window.bridge` 物件呼叫主頁面能力，主頁面透過 `postMessage` 橋接實作。

```typescript
// 注入到每個 iframe 的 bridge 介面
interface Bridge {
  llm: {
    chat(messages: Message[], options?: { stream?: boolean }): Promise<string>
  }
  data: {
    read(name: string, options?: { rows?: number; offset?: number }): Promise<unknown>
  }
  mcp: {
    call(serverName: string, tool: string, params: Record<string, unknown>): Promise<unknown>
    listTools(serverName: string): Promise<MCPTool[]>
  }
  api: {
    fetch(name: string, options?: RequestInit): Promise<unknown>
  }
}
```

主頁面負責：
- 代理所有 LLM 請求（持有 API Key，iframe 無法直接取得）
- 從 OPFS 讀取大型檔案並分塊串流給 iframe
- 連接 MCP Server（SSE / Streamable HTTP）並轉發 Tool 呼叫結果
- 代理外部 API fetch（繞過 CORS 限制）

## 版本歷史

### 觸發時機

每次 LLM 完成一輪程式碼生成（patch 套用完畢）後，系統自動建立一個新的 `ToolVersion` snapshot，不需要用戶手動儲存。

### 樹狀版本結構

版本歷史是**樹狀**而非線性，透過 `parentVersionId` 連結。用戶可在 `/create` 切換到任意歷史版本，從該版本繼續對話修改，此時新生成的版本以該歷史版本為 parent，形成新的分支。

```
v1 (根)
├── v2 (加入折線圖)
│   ├── v3 (改成深色主題)
│   └── v4 (加上篩選器) ← 從 v2 分支
└── v5 (改用表格) ← 從 v1 分支
```

`ToolDefinition.currentVersionId` 記錄當前顯示的版本。

### 版本歷史 UI

位於 `/create` 右側預覽區上方，顯示樹狀時間軸（Ant Design Tree 或自訂 Timeline）。用戶可以：
- 點擊任一版本切換預覽和對話紀錄
- 從任意版本分支繼續修改（切換後對話框清空，以該版本的 conversation 為基礎）
- 為版本加上說明標籤（`label`）
- 刪除某個分支（刪除該節點及其所有子孫）

版本資料存在 localStorage 的 `ToolDefinition` 內。匯出 JSON 時版本歷史一併匯出。

## LLM 生成流程

### 首次生成

1. 用戶描述需求，可指定使用哪些資料來源
2. 系統組裝 system prompt，包含：`window.bridge` API 文件 + 已選資料來源的 schema 摘要 + 輸出格式說明
3. LLM streaming 輸出完整 HTML，串流文字即時顯示在對話泡泡中（用戶可見生成過程）
4. 串流結束後，前端解析 HTML，注入 bridge 腳本，寫入 iframe `srcdoc`，預覽區刷新
5. 自動建立第一個 `ToolVersion`（根節點）

### 後續增量修改（節省 token）

後續每輪對話，LLM 輸出格式為**說明文字 + patch 區塊**：

```
我將加入折線圖並調整資料格式。

<patch>
  <find><![CDATA[// 要被替換的原始程式碼片段（唯一可識別）]]></find>
  <replace><![CDATA[// 替換後的程式碼]]></replace>
</patch>
```

**串流 UX**：
- LLM 串流過程中，說明文字部分即時顯示在對話泡泡（用戶可見生成過程，不會卡頓）
- `<patch>` 區塊串流時在對話泡泡中以 code block 顯示（可折疊）
- 串流結束後，前端從回應中提取所有 patch，套用到當前程式碼，iframe 預覽刷新
- 建立新的 `ToolVersion` snapshot，對話歷史存入說明文字（不含 patch 本身）

**Token 控制**：
- System prompt 每輪都帶入**當前版本的完整程式碼**（支援 prompt caching 降低費用）
- 對話歷史（messages array）只保留用戶需求 + LLM 說明文字，不重複傳入 patch 內容
- 若 patch 套用失敗（找不到對應片段），fallback 要求 LLM 重新輸出完整程式碼

### 從歷史版本繼續修改

切換到歷史版本後，system prompt 中的「當前程式碼」換成該歷史版本的 `code`，對話紀錄重置為該版本的 `conversation`，後續生成的版本以該歷史版本為 `parentVersionId`。

## MCP 連線

- **SSE transport**：連接 `GET {url}/sse`，接收 Server-Sent Events；工具呼叫透過 `POST {url}/messages`
- **Streamable HTTP transport**：所有請求透過 `POST {url}` 發送，支援 streaming 回應
- 用戶在 `/settings` 填入 MCP Server URL 和 transport 類型後，系統在背景建立連線並快取可用 Tool 清單

## 分享機制

- **匯出**：點「匯出 JSON」下載 `.webcraft.json` 定義檔
- **匯入**：首頁點「匯入」上傳 `.webcraft.json`，系統解析後儲存至 localStorage，大型檔案資料需用戶另行上傳
- 無帳號、無雲端，所有資料留在用戶瀏覽器

## 部署

- GitHub Actions workflow：push to `main` → `npm run build` → 部署到 `gh-pages` 分支
- 使用 Hash Router（`/#/create`），避免 GitHub Pages 靜態 hosting 的路由問題
- `.gitignore` 加入 `.superpowers/`

## 非目標（不在此版本範圍）

- 帳號系統 / 雲端同步
- 協作編輯
- 行動裝置優化（以桌面為主）
