# WebCraft AI — 重寫規格書（Code-to-Spec）

**目的：** 本文件是從現行實作反推、整理、並修正已知缺陷後的**目標行為規格**，供另一套流程／代理人依此**從零重新實作**整個系統。文件依「基礎到進階、每個里程碑可獨立驗證交付」拆解為 M0–M11。

**與 `docs/webcraft-ai.md` 的關係：** 舊文件是「現行系統」的架構紀錄與變更歷史，繼續保留作為歷史參考。本文件是獨立的、面向重寫的**目標規格**，兩者不會互相同步更新。

**修正原則：** 本文件描述的是**修正後的正確行為**，不是現行程式碼的逐行翻版。現行實作中審查發現的缺陷（見附錄 A）已直接內化為下方對應章節的硬性需求，重寫時不應重蹈覆轍。

**詳細度原則：** 本文件描述每個功能「要做什麼、輸出格式的結構化規則、驗收標準」，**不逐字提供 system prompt 文案**——prompt 的實際用字由實作時自行撰寫，只要滿足本文件列出的行為規則與輸出格式即可。

---

## 目錄

1. [系統概述](#1-系統概述)
2. [技術基礎（必要）](#2-技術基礎必要)
3. [非目標](#3-非目標)
4. [資料模型](#4-資料模型)
5. [頁面與路由](#5-頁面與路由)
6. [Bridge API 契約](#6-bridge-api-契約)
7. [兩套生成引擎總覽](#7-兩套生成引擎總覽)
8. [安全性需求（強制）](#8-安全性需求強制)
9. [品質與 CI 需求（強制）](#9-品質與-ci-需求強制)
10. [無障礙與響應式需求](#10-無障礙與響應式需求)
11. [里程碑 M0–M11](#11-里程碑)
12. [附錄 A：現行系統已知缺陷對照表](#附錄-a現行系統已知缺陷對照表)

---

## 1. 系統概述

WebCraft AI 是一個**純前端**的 AI 網頁工具生成平台。使用者以自然語言描述需求，由 LLM 生成**單檔 HTML 小工具**，工具在瀏覽器沙箱中執行、可綁定資料來源、可持久化狀態、可分享。系統本身**沒有後端伺服器**，部署為 GitHub Pages 靜態站台。

系統提供**兩套並存的生成引擎**（詳見第 7 節），使用者可自由切換：

- **引導式管線（Pipeline Engine）**：固定的「腦力激盪 → 計畫 → 生成 → 增量修改」流程，可預測、逐步可視。
- **Deep Agent 引擎（Agent Engine）**：LLM 透過工具呼叫（function calling）自主決定「讀資料 → 寫程式碼 → 自我測試 → 修錯 → 結束」，不受固定流程束縛。

兩者共用同一套版本系統、資料來源、Bridge API、分享/備份機制。

---

## 2. 技術基礎（必要）

以下為重寫時的**必要基礎**，非建議：

| 項目 | 要求 |
|---|---|
| 框架 | React 18 + TypeScript |
| 建置 | Vite |
| UI 元件庫 | Ant Design 5，全站使用 theme token 上色（見第 10 節），禁止寫死色碼 |
| 路由 | React Router v6，**必須用 HashRouter**（GitHub Pages 靜態 hosting 無法處理 history API 路由）|
| 持久化 | `localStorage`（工具定義、設定）+ OPFS（Origin Private File System，大型資料檔）|
| 測試 | vitest（純邏輯/服務層測試），**CI 必須執行**（見第 9 節）|
| 部署 | GitHub Actions → GitHub Pages（`actions/deploy-pages`），`vite.config` 的 `base` 設為相對路徑 |
| Lint | ESLint（`typescript-eslint` + `eslint-plugin-react-hooks`），CI 需跑 lint |
| PWA | Service worker（離線可用、可安裝）+ web manifest + favicon |
| 語言 | UI 文案一律繁體中文 |

**Bundle 分割警告**：不可手動用 `manualChunks` 拆分 `react`/`antd`/`icons` 等有跨模組初始化相依的套件——會破壞執行期初始化順序。若要 code-split，僅用路由層級的 `React.lazy`。

---

## 3. 非目標

- 帳號系統 / 雲端同步
- 多人即時協作
- 任何形式的後端服務（含 serverless function）
- 行動裝置以外的原生 App（PWA 已足夠涵蓋「可安裝」需求）

---

## 4. 資料模型

以下為 localStorage 儲存的核心型別（TypeScript 介面）：

```ts
interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ToolVersion {
  versionId: string
  parentVersionId: string | null   // null = 樹狀結構的根節點
  createdAt: string                // ISO 8601
  label?: string                   // 使用者自訂版本標籤
  code: string                     // 該版本的完整單檔 HTML
  conversation: Message[]          // 該版本對應的對話紀錄（不含程式碼本身）
}

type DataSource =
  | { type: 'file'; name: string; opfsPath: string }
  | { type: 'api'; name: string; url: string; headers: Record<string, string> }
  | { type: 'mcp'; name: string; serverRef: string }  // 指向 Settings.mcpServers[].id

interface ToolDefinition {
  id: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
  currentVersionId: string
  versions: ToolVersion[]          // 樹狀版本歷史
  dataSources: DataSource[]
  conversation: Message[]          // 目前顯示中的對話（腦力激盪階段尚無版本時使用）
}

interface MCPServer {
  id: string
  name: string
  url: string
  transport: 'sse' | 'streamable-http'
}

interface Settings {
  llm: { endpoint: string; apiKey: string; model: string }
  mcpServers: MCPServer[]
}

interface MCPTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}
```

**localStorage key 命名空間**（全部以 `webcraft_` 為前綴，供全域搜尋/清除/備份使用）：

| Key | 內容 |
|---|---|
| `webcraft_tools` | `ToolDefinition[]` |
| `webcraft_settings` | `Settings` |
| `webcraft_theme` | `'light' \| 'dark'` |
| `webcraft_toolstore_<toolId>` | 該工具透過 `bridge.storage` 自行寫入的資料（`Record<string, unknown>`）|

**匯出格式**（`.webcraft.json`）：

```ts
interface ExportedTool extends Omit<ToolDefinition, 'dataSources'> {
  dataSources: ExportedDataSource[]
  exportedAt: string
  warnings?: string[]
}

type ExportedDataSource =
  | { type: 'file'; name: string; opfsPath: string; embedded?: string /* base64，<10MB 才內嵌 */ }
  | { type: 'api'; name: string; url: string /* headers 一律移除，見第 8 節 */ }
  | { type: 'mcp'; name: string; serverRef: string }
```

---

## 5. 頁面與路由（HashRouter）

| 路由 | 說明 |
|---|---|
| `/` | 工具庫首頁：卡片網格、搜尋、範本、新增、匯入；卡片選單（開啟/編輯/複製/分享連結/匯出/刪除）|
| `/create`、`/create/:id` | 建立/編輯工具主畫面（詳見第 7、11 節）|
| `/tool/:id` | 全頁使用工具：沙箱 iframe 全螢幕、浮動按鈕（返回/編輯）、執行期錯誤橫幅（含「前往編輯修復」）|
| `/data` | 資料來源管理：上傳檔案／貼上 JSON／預覽（CSV 轉表格、JSON 格式化）／刪除，OPFS 用量顯示 |
| `/settings` | LLM 設定＋測試連線、MCP Server CRUD、localStorage 用量顯示、完整備份/還原 |
| `/import` | 解析分享連結 `?d=<base64>` 參數，還原工具並導向 `/tool/:id` |

**`/create` 版面規則：**
- 桌機：左側對話欄**固定寬度**（不可隨右側內容縮放）＋右側預覽（Tabs：預覽／程式碼／差異／版本）。
- 手機：對話與預覽以 Tabs 切換，不並排。

---

## 6. Bridge API 契約

生成的工具程式碼在 **sandbox iframe**（`sandbox="allow-scripts"`、`srcdoc`、origin 為 `null`，**不給 `allow-same-origin`**）中執行。因為 origin 為 opaque，**無法用 `<script src="...">` 載入外部腳本**——bridge 腳本必須以字串**內聯**注入 HTML。也因為 opaque origin，iframe 內**不能使用 `localStorage`/`sessionStorage`**（呼叫會拋錯），所有持久化一律透過 `bridge.storage`。

主頁面與 iframe 透過 `postMessage` 溝通，每個請求帶唯一 `requestId` 供配對回應；主頁面收到訊息時**必須**驗證 `event.source === iframe.contentWindow` 才處理。

```ts
window.bridge = {
  llm: {
    // 呼叫使用者設定的 LLM。system/json/onChunk 皆為選用。
    chat(
      messages: { role: 'user' | 'assistant'; content: string }[],
      options?: { system?: string; json?: boolean; onChunk?: (text: string) => void }
    ): Promise<string>
  },
  data: {
    // 讀取已綁定的「檔案型」資料來源。CSV 解析成物件陣列；JSON 回傳解析後的值。
    read(name: string, options?: { rows?: number; offset?: number }): Promise<unknown>
  },
  api: {
    // 代理已綁定的「API 型」資料來源請求（繞過 CORS，headers 由主頁面附加）。
    fetch(name: string, options?: RequestInit): Promise<unknown>
  },
  mcp: {
    call(serverName: string, tool: string, params: Record<string, unknown>): Promise<unknown>
    listTools(serverName: string): Promise<MCPTool[]>
  },
  storage: {
    // 依「工具 id」隔離的持久化儲存，取代 localStorage。
    get(key: string): Promise<unknown>       // 不存在回傳 null
    set(key: string, value: unknown): Promise<void>
    remove(key: string): Promise<void>
    keys(): Promise<string[]>
  },
}
```

**名稱容錯解析（`data.read` / `api.fetch` / `mcp.call` 的 name/serverName 參數）：** LLM 生成程式碼時，偶爾會把資料來源的中文名稱翻譯成英文（例如「新聞」→ `news`），導致精確比對找不到。主頁面解析名稱時必須依序嘗試：

1. 精確字串比對
2. 忽略大小寫與前後空白比對
3. 若該類型（file/api/mcp）目前**只有唯一一個**來源，直接使用它
4. 皆失敗時回傳錯誤，錯誤訊息附上「目前可用的名稱清單」

**錯誤回應格式：** `{ requestId, error: string, done: true }`，串流中的部分結果用 `{ requestId, chunk: string, done: false }`，最終結果用 `{ requestId, result: unknown, done: true }`。

**執行期錯誤回報：** 注入腳本必須攔截 iframe 內的 `window.onerror` 與 `unhandledrejection`，透過 `postMessage({ __wcToolError: true, message, stack })` 回報給主頁面（不透過上面的 requestId 機制，因為這是主動推播、非請求回應）。

**⚠️ 用量防護（強制，修正現行缺陷）：** `bridge.llm.chat` 沒有速率限制的話，生成工具的程式碼可能無限迴圈呼叫 LLM，燒光使用者的 API 額度。主頁面必須對「單一工具的單次執行」設定呼叫次數上限（建議：每次頁面載入 iframe 起算，上限可設定，超過時回傳明確錯誤如 `"已達本次執行的 LLM 呼叫上限"`），避免無節制消耗。

---

## 7. 兩套生成引擎總覽

系統核心是「使用者對話 → 產生/修改單檔 HTML → 存成版本」，但**有兩種達成方式**，使用者在 `/create` 頁以一個開關切換：

### 7.1 引導式管線（Pipeline Engine，預設）

固定四階段流程：

```
腦力激盪 ──(使用者按「生成工具」)──▶ 計畫（可選/可跳過）──▶ 首次生成 ──▶ 增量修改（重複）
```

- **腦力激盪**：新工具預設進入此階段。LLM 只問澄清問題、不寫程式碼；問題以結構化 JSON 輸出（見 11.5），前端渲染成可點選表單；蒐集足夠資訊時標記「就緒」。使用者**隨時**可跳過、直接生成。
- **計畫（可選）**：按「生成工具」時，先請 LLM 提出 3–6 步的建構計畫，使用者可刪減步驟後「開始建構」（逐步執行、每步一個版本、即時顯示進度）或「直接生成」（跳過分步，走傳統單次生成）。
- **首次生成**：輸出完整 HTML，建立根版本。
- **增量修改**：後續每輪對話輸出「說明文字 + 一個或多個 patch 區塊」，只描述改動，不重複貼整份程式碼（省 token）；套用失敗時 fallback 為完整重寫。

### 7.2 Deep Agent 引擎（Agent Engine）

使用者切到 Agent 模式後，**同一個對話輸入框**改為驅動一個「工具呼叫自主迴圈」：

1. LLM 收到系統指示與使用者需求，**自主決定**下一步要呼叫哪個工具（見 11.11 的工具清單），不是照固定流程走。
2. 每次工具呼叫的結果都回饋給 LLM，讓它決定下一步——可能是「先讀資料」「寫程式碼」「執行測試」「發現錯誤後修正再測」，直到它呼叫 `finish` 工具或直接以文字回覆結束。
3. 過程中每一步都即時呈現在 UI 的「Agent 活動」區塊（例如：📖 讀取資料中…　✍️ 寫入程式碼…　🧪 測試中…　發現錯誤，修正中…）。
4. 整個迴圈設有**步數上限**（防止無限迴圈）與**可中止**（使用者可隨時停止）。
5. 迴圈結束時，把過程中變動的程式碼**一次性**提交為一個新版本（不會每個中間工具呼叫都各自建一個版本，避免版本樹被灌爆）。

兩套引擎**共用**：版本系統、Bridge API、資料來源綁定、自動命名、下一步建議、匯出/分享/備份。

---

## 8. 安全性需求（強制）

這些是本次重寫**必須**滿足的安全需求（多數是修正現行系統審查時發現的實際缺陷）：

1. **憑證絕不外洩**：
   - Settings 中的 LLM `apiKey` **絕對不可**出現在匯出的 `.webcraft.json`、分享連結、或任何工具的生成程式碼中。
   - `DataSource` 中 `type: 'api'` 的 `headers`（可能含 Authorization token）**匯出與分享時必須整包移除**，只保留 `name`/`url`；若原本設有 headers，需在匯出流程提示使用者「認證標頭未包含，接收方需自行設定」。**完整備份/還原**（見 11.9）例外——備份本來就設計成含所有機密資料的完整還原點，需在 UI 明確警告「備份檔含 API Key 與認證資訊，請妥善保管」。
2. **沙箱隔離**：生成工具的 iframe 一律 `sandbox="allow-scripts"`，**不給** `allow-same-origin`（否則沙箱形同虛設）。
3. **postMessage 來源驗證**：主頁面處理任何 bridge 訊息前，必須驗證 `event.source === iframe.contentWindow`。
4. **LLM 呼叫用量防護**：見第 6 節「用量防護」。
5. **API Key 儲存告知**：Settings 頁需明確告知「API Key 以明文存於此瀏覽器，請勿在共用裝置使用」。
6. **Agent 引擎的迴圈上限**：Deep Agent 迴圈必須有明確的最大步數上限與 abort 機制（見 11.11）。

---

## 9. 品質與 CI 需求（強制）

修正現行系統「CI 只 build 不測試」的缺陷：

1. **CI 部署前必須跑**（依序，任一失敗即中止部署）：
   1. `tsc --noEmit`（型別檢查）
   2. ESLint
   3. `vitest run`（單元測試）
   4. `vite build`
2. **單元測試覆蓋範圍（最低要求）**：任何「純邏輯、可脫離 React 測試」的服務都必須有對應測試，至少包含：
   - 對話/程式碼輸出格式解析（見 11.4 的哨符機制）
   - patch 套用邏輯（含 fallback）
   - 版本 diff 演算法
   - **Bridge 名稱容錯解析邏輯**（現行系統這塊完全沒測試，必須補上）
   - **匯出/分享的憑證移除邏輯**（必須有測試斷言 headers/apiKey 不會出現在輸出中——這是直接針對第 8 節安全需求的回歸測試）
   - 資料摘要的結構感知截斷（見 11.6）
   - 腦力激盪問題解析、計畫解析
   - Agent 迴圈（可用假的 chat 函式注入腳本化回應測試，不需真的呼叫 LLM）
3. **元件與邏輯分離**：任何頁面元件（尤其是 `/create` 主畫面）承載的「生成流程邏輯」應拆到可獨立測試的 hook 或 service，**不應該把五種生成模式的狀態與流程全部塞進單一頁面元件**——這是現行系統的已知問題（單一檔案逼近 900 行、無法單元測試），重寫時應以「每種生成模式一個 hook（如 `useBrainstorm`、`usePlanBuild`、`useAgentTurn`、`useEditTurn`），頁面元件只負責組裝 UI 與呼叫 hook」為原則。

---

## 10. 無障礙與響應式需求

修正現行系統「24 個元件中僅 1 處有 `aria-label`」的缺陷：

1. **所有純圖示按鈕**（無文字標籤的 icon button，如刪除、複製、分享、匯出、編輯）**必須**加 `aria-label`。
2. **鍵盤可操作**：所有互動元件（按鈕、表單、可點 chip/tag）需可用 Tab 鍵到達與 Enter/Space 觸發。
3. **色彩**：全站使用 Ant Design theme token（`theme.useToken()`），不可寫死色碼，才能正確支援 dark/light 主題切換且保持對比度。
4. **響應式（行動優先）**：
   - 斷點以 AntD Grid（`xs/sm/md/lg/xl`）為準，`< md` 視為行動版。
   - Header 導覽在行動版收進漢堡選單＋Drawer。
   - `/create` 桌機雙欄、行動版分頁切換。
   - 所有表格在窄螢幕可水平捲動。
   - 驗收：所有頁面在 ≤375px 寬度下無水平溢出、按鈕可正常點擊。

---

## 11. 里程碑

每個里程碑結束都必須是**可獨立展示、可獨立驗證**的產品增量——不會出現「做一半不能用」的中間態。每個里程碑列出：目標、範圍、功能需求、驗收清單。

### M0 — 基礎骨架與部署管線

**目標：** 一個可上線的空殼，部署管線（含測試/lint 關卡）打通。

**範圍：**
- Vite + React + TS + AntD 專案初始化，`tsconfig` 嚴格模式。
- HashRouter，五個路由的空白頁（含 AppHeader、Layout）。
- Dark/Light 主題（`ThemeProvider`，持久化於 `webcraft_theme`，切換開關在 Header）。
- 響應式外殼（桌機橫向導覽／手機漢堡選單 + Drawer）。
- PWA（manifest + service worker：導覽 network-first、同源資源 cache-first、跨來源請求不攔截）+ favicon。
- GitHub Actions：`tsc --noEmit` → ESLint → `vitest run`（此時可能 0 個測試，先把關卡建好）→ `vite build` → `actions/deploy-pages` 部署，皆綠燈才部署。

**驗收清單：**
- [ ] 網站可在 GitHub Pages 開啟，顯示五個空白路由可導覽
- [ ] 切換 dark/light，UI 色彩正確反應、重整後保留選擇
- [ ] 縮小視窗至手機寬度，導覽變成漢堡選單
- [ ] CI pipeline 的四個關卡（型別/lint/測試/build）都會執行且顯示於 workflow log
- [ ] 瀏覽器「加到主畫面」可安裝、離線可開啟已快取過的頁面

---

### M1 — 本地工具庫（尚未接 AI）

**目標：** 先證明「儲存、渲染、管理工具」這條主幹線是通的，暫不涉及 LLM。

**範圍：**
- `ToolDefinition`/`ToolVersion` 型別與 `localStorage` CRUD（`webcraft_tools`）。
- 沙箱 iframe 渲染元件（`sandbox="allow-scripts"` + `srcdoc`），此階段先不注入 bridge。
- 首頁工具卡片網格（含搜尋框過濾名稱/描述）、新增（先以 2–3 個內建範本 HTML 建立，不靠 AI）、開啟／複製／刪除。
- `/tool/:id` 全頁渲染 + 找不到工具時的錯誤畫面。

**驗收清單：**
- [ ] 從範本新增一個工具，出現在首頁卡片網格
- [ ] 開啟工具可在全頁 iframe 正常運作（範本本身用純 JS/localStorage 等級的簡單互動）
- [ ] 複製工具產生新 id 的副本
- [ ] 刪除工具、重新整理頁面後仍維持刪除狀態（驗證 localStorage 持久化）
- [ ] 搜尋框可依名稱/描述過濾卡片

---

### M2 — LLM 連線設定

**目標：** 使用者能設定並驗證自己的 LLM 連線，尚不涉及生成。

**範圍：**
- Settings 頁：LLM Endpoint／API Key／Model 表單，「測試連線」按鈕。
- 串流客戶端基礎（OpenAI-compatible `/chat/completions`，`stream: true`）：**必須正確處理跨 network chunk 的 SSE 行緩衝**（一行 `data:` 可能被切在兩個 chunk 中間，需累積緩衝再逐行解析，不可假設一個 chunk 剛好是完整的一行或多行）。
- MCP Server 清單 CRUD（僅設定，暫不實際連線）。
- Settings 明確標示 API Key 明文儲存的風險提示。

**驗收清單：**
- [ ] 填入設定並儲存，重整頁面後設定仍在
- [ ] 「測試連線」對有效設定回報成功、無效設定回報失敗且有可讀的錯誤訊息
- [ ] 新增/編輯/刪除 MCP Server 設定，持久化正確
- [ ] 對一個真實可用的 LLM endpoint 手動觸發一次串流請求（可用簡易測試頁或單元測試以假 fetch 驗證），確認 SSE 逐行解析正確、無漏字

---

### M3 — 首次生成（核心主軸起點）

**目標：** 使用者一句話描述需求，AI 生成出可運作的工具。這是整個系統最重要的一刀。

**範圍：**
- 對話面板：訊息以 Markdown 渲染（assistant 端），多行輸入（桌機 Enter 送出/Shift+Enter 換行，手機 Enter 換行改用送出鈕）。
- **對話與程式碼輸出的分流機制**：LLM 輸出格式須包含「給人看的說明」與「完整 HTML 程式碼」兩部分，且**程式碼區必須用專屬的、不可能出現在一般 HTML/JS 程式碼中的界定標記包起來**（而非借用 markdown ` ``` ` 圍欄——若程式碼本身含反引號，會被假關閉導致內容被切斷、洩漏進對話框）。前端即時串流解析時，需能：
  - 只把「說明」部分顯示在對話框
  - 把「程式碼」部分即時顯示在獨立的「程式碼」檢視區（逐字/逐行呈現生成過程，而非等到全部完成才顯示，避免使用者以為畫面卡住）
  - 串流中若程式碼界定標記only出現一半，不可讓標記本身的殘缺片段閃現在對話框
  - 需提供至少一層 fallback（例如識別「一整段以 `<!doctype html>` 開頭到 `</html>` 結尾」的內容也視為程式碼），因應 LLM 偶爾不遵守格式的情況
- 首次生成的系統指示需求：依對話內容產出完整單檔 HTML（內聯 CSS/JS）、現代響應式版面、繁中介面；不依賴外部 CDN；不可使用 `localStorage`（此階段 bridge 尚未注入，程式碼本身應避免依賴尚不存在的能力，或這個限制從 M6 起才需要在 prompt 中明確提及）。
- 生成完成後：建立根版本（`parentVersionId: null`），iframe 預覽刷新，程式碼檢視區顯示完整程式碼，自動切回「預覽」分頁。

**驗收清單：**
- [ ] 輸入一句需求描述，觀察串流過程：對話框只顯示說明文字，「程式碼」分頁即時逐步顯示程式碼
- [ ] 生成結束後，「預覽」分頁顯示可運作的工具
- [ ] 刻意讓 LLM 生成一個「程式碼裡包含三個反引號」的工具（例如做一個顯示程式碼片段的小工具），確認對話框與程式碼分流依然正確、不互相污染
- [ ] 中途按「停止」可正確中止串流

---

### M4 — 增量修改、版本樹、差異比對

**目標：** 多輪修改，且能回溯、分支、比較版本差異。

**範圍：**
- 後續每輪修改的系統指示需求：輸出「說明 + 一個或多個結構化 patch 指令（find/replace 語意）」；`find` 必須是目前程式碼中精確且唯一的子字串；套用失敗（找不到對應片段）時 fallback 為要求 LLM 完整重寫。
- patch 串流中即時呈現：把「目前已串流完成的 patch」即時套用到目前程式碼、顯示在程式碼分頁，讓使用者看到程式碼被改的過程（而非空白到結束才顯示）。
- 版本樹：`ToolVersion.parentVersionId` 形成樹狀結構；版本歷史面板可切換／加標籤／刪除某節點及其子孫／「精簡版本」（只保留目前版本、刪除其餘，釋放空間）。
- 差異比對：以行級 diff 演算法（如 LCS）比較「目前版本」與「其父版本」，標示增/刪行數與內容。
- 快捷動作：「重新生成最後一輪」（還原到上一版重做）、「編輯最後一則」（把訊息載回輸入框、還原版本）、「刪除最後一則」（移除該輪對話與其產生的版本）。

**驗收清單：**
- [ ] 對已生成的工具連續做 3 輪修改，版本樹正確顯示線性歷史
- [ ] 切回某個歷史版本、從該處繼續修改，版本樹正確長出分支
- [ ] 「差異」分頁正確顯示某版本與其父版本的增刪行
- [ ] 刻意讓一次 patch 的 `find` 對不上（例如版本已被切到別的分支），確認 fallback 完整重寫機制觸發且成功產生新版本
- [ ] 「精簡版本」後版本樹只剩一個節點
- [ ] 「重新生成」「編輯最後一則」「刪除最後一則」三個快捷動作各自行為正確

---

### M5 — 腦力激盪與計畫式生成（Pipeline 的完整體驗）

**目標：** 生成前先釐清需求、先出計畫，讓產出更貼近使用者預期。

**範圍：**
- **腦力激盪階段**：新建工具預設先進入此階段（尚無版本時）。系統指示需求：只問 1–3 個關鍵澄清問題、絕不輸出程式碼；問題以結構化 JSON 輸出，每題標註類型：
  - `single`（單選）：選項互斥、正常只選一個
  - `multi`（複選）：使用者可能同時要多個
  - `text`（自由輸入）：開放式、難以列舉選項
  - 前端據此渲染成可點選表單（單選/複選按鈕 + 自動附加「其他（自行輸入）」選項），使用者需**全部答完**才能一次送出、開啟下一輪。
  - LLM 認為資訊已足夠時，改為輸出一句總結 + 特殊「就緒」標記，UI 據此提示使用者可以生成（例如按鈕高亮）。
  - 「生成工具」按鈕**隨時可按**（不強制等 LLM 判斷完成）。
- **計畫階段（可選）**：按下生成前，先請 LLM 提出 3–6 步的建構步驟清單；使用者可刪除不要的步驟；「開始建構」逐步執行（第一步＝完整生成，後續步驟＝patch），每步各自建立版本並即時顯示待辦／進行中／完成／錯誤狀態；某步失敗可「繼續建構」從該步重試；也提供「直接生成」跳過分步、走 M3 的單次生成路徑。

**驗收清單：**
- [ ] 新建工具，觀察 LLM 先提出可點選的澄清問題（單選/複選/文字混合），全部答完才送出
- [ ] 多輪腦力激盪後 LLM 給出「就緒」提示，UI 對應反應
- [ ] 任何時候按「生成工具」都能跳過腦力激盪直接生成
- [ ] 生成前出現分步計畫，刪除其中一步後開始建構，確認被刪除的步驟未執行
- [ ] 刻意讓計畫某一步生成失敗（如斷網或無效設定），確認可用「繼續建構」從失敗步驟續做
- [ ] 「直接生成」正確跳過分步、走一次性生成流程

---

### M6 — 資料來源與 Bridge 核心能力（data / storage）

**目標：** 工具能讀取真實資料、能保存自己的狀態。

**範圍：**
- OPFS 服務：上傳檔案、貼上 JSON 文字直接建檔（validate JSON 合法性）、預覽（CSV 轉表格、JSON 格式化，只讀取檔案前綴避免大檔案卡頓）、刪除、用量顯示；瀏覽器不支援 OPFS 時要有明確提示與降級（功能停用而非壞掉）。
- 資料解析：CSV 解析成物件陣列；JSON 解析成對應值。
- **結構感知的內容摘要**（給 LLM 看資料用）：不可對整段字串做固定字元數的粗暴截斷（會把第一筆資料切成不合法的殘缺片段）。應遞迴依結構截斷：
  - 過長的字串值縮短並保留省略記號
  - 陣列只取樣少數筆數，並標注「共 N 筆」
  - 限制巢狀深度
  - **無論如何都要保留所有欄位名稱**，即使某一筆資料本身很大
  - 最終仍套一個總長度上限當保險
- `DataSourceBinder`：勾選已上傳檔案綁定到工具；新增/編輯 API 型來源（含可設定請求標頭，供需認證的 API 使用）；勾選已設定的 MCP Server 綁定到工具。
- Bridge：實作 `bridge.data.read`（含名稱容錯解析，見第 6 節）與 `bridge.storage`（get/set/remove/keys，依工具 id 隔離）；bridge 腳本以字串內聯注入 iframe（不可用外部 `<script src>`，因 opaque origin 無法載入）。
- **腦力激盪與生成階段都要能看到已綁定資料的內容摘要**（不是只有生成/修改階段才注入，腦力激盪階段若已綁定資料來源也要能據此提問，這是現行系統修正過的行為，必須保留）。

**驗收清單：**
- [ ] 上傳一份 CSV，DataPage 可預覽成表格
- [ ] 貼上一段 JSON 文字直接建檔（不需先存成檔案再上傳）
- [ ] 在 `/create` 綁定該資料來源後，腦力激盪階段 LLM 的提問確實針對該資料的實際欄位
- [ ] 生成一個「讀取並顯示這份資料」的工具，`bridge.data.read` 正確回傳資料
- [ ] 生成一個用 `bridge.storage` 保存狀態的工具（如計數器/筆記），重新整理工具頁後狀態保留
- [ ] 準備一份「第一筆資料本身就很大」的 JSON，確認資料摘要仍完整列出所有欄位名稱、只是長值被縮短
- [ ] 瀏覽器停用/不支援 OPFS 時，DataPage 顯示明確提示而非空白錯誤

---

### M7 — Bridge 外部整合（llm / api）與自動修復

**目標：** 生成的工具能回呼 LLM、呼叫外部 API，並能自我偵錯。

**範圍：**
- `bridge.llm.chat`：轉發到主頁面持有的 LLM 設定；支援 `system` 提示、`json` 模式（要求結構化輸出）、串流回呼；**依第 8 節安全需求實作用量防護**。
- `bridge.api.fetch`：代理已綁定的 API 來源請求（附加設定的 headers，繞過 CORS）。
- 自動修復：iframe 內攔截執行期錯誤（`window.onerror`/`unhandledrejection`）並回報主頁面；使用工具頁與編輯頁都顯示錯誤橫幅＋「修復」按鈕（把錯誤內容當一次修改請求餵回 LLM，走 M4 的 patch 流程）；編輯頁可選「偵測到錯誤自動修復」開關（設連續嘗試上限，避免無限重試）。

**驗收清單：**
- [ ] 生成一個「呼叫 LLM 做摘要」的工具，實測可正確取得回應
- [ ] 生成一個要求 JSON 輸出的呼叫，回傳內容可被 `JSON.parse`
- [ ] 生成一個呼叫外部 API 的工具，確認繞過 CORS 正常運作
- [ ] 故意讓生成的工具產生執行期錯誤，確認錯誤橫幅出現且「修復」可產生修正版本
- [ ] 開啟「自動修復」開關，確認錯誤發生後在上限次數內自動嘗試修復、超過上限則停止
- [ ] 撰寫一個刻意無限呼叫 `bridge.llm.chat` 的測試工具，確認用量防護生效、不會無止盡燒 API 額度

---

### M8 — 生成體驗打磨

**目標：** 讓生成過程更順手、更聰明。

**範圍：**
- 自動命名：首次生成後若工具仍是預設名稱，依對話內容自動產生簡短名稱＋一句話描述。
- 下一步建議：每次生成/修改完成後，以結構化輸出請 LLM 提出 2–3 個「下一步」建議，前端呈現成可點選的 chip，點擊即當作一次修改請求送出。
- 參考圖生成（多模態）：對話輸入可附加圖片，最後一則使用者訊息連同圖片一起送給支援視覺的模型，system 指示要求盡量比照參考圖的版面與風格。
- Token 用量顯示：若 LLM 服務有回傳用量資訊，於工具列顯示上次生成的 token 數（輸入/輸出拆分於 tooltip）。

**驗收清單：**
- [ ] 首次生成後，工具名稱自動從「新工具」變成貼合需求的名稱
- [ ] 生成完成後出現下一步建議 chip，點擊觸發對應修改
- [ ] 附上一張介面截圖，生成結果的版面明顯參考該截圖
- [ ] 使用支援用量回報的 LLM 服務，工具列正確顯示 token 數；使用不支援的服務則優雅地不顯示（不報錯）

---

### M9 — 分享與持久化

**目標：** 工具可以匯出、分享、完整備份還原。

**範圍：**
- 匯出 `.webcraft.json`：小型檔案型資料來源（<10MB）內嵌 base64；API 型來源**移除 headers**（見第 8 節）；過大檔案不內嵌並附警告文字。
- 匯入：解析 `.webcraft.json`，還原工具（賦予新 id 避免碰撞），內嵌資料寫回 OPFS。
- 分享連結：把工具（精簡為目前版本、不含完整對話歷史）編碼進 URL hash 參數；連結過長（預估）時提示改用匯出檔案；`/import` 路由解碼還原並開啟。
- 完整備份／還原：匯出全部 `webcraft_*` 命名空間（工具、設定、各工具的 bridge.storage 資料、主題設定）；還原前需二次確認（會覆蓋現有資料）；UI 需警告備份檔含 API Key 等機密資訊。

**驗收清單：**
- [ ] 匯出一個綁定了「有設定認證標頭」API 來源的工具，用測試檢查匯出檔案內容**不含**該 headers
- [ ] 匯出後匯入，工具正確還原（含版本歷史）、取得新 id
- [ ] 產生分享連結，開啟該連結能正確還原並開啟工具
- [ ] 產生一個工具過大的分享連結，確認有「連結過長」提示並建議改用匯出
- [ ] 完整備份後清空瀏覽器資料、還原備份，所有工具、設定、bridge.storage 資料都正確恢復
- [ ] 單元測試斷言：匯出/分享的資料結構中不存在 `apiKey` 欄位、不存在 api 來源的 `headers` 欄位

---

### M10 — MCP 整合

**目標：** 連接外部 MCP Server，擴充工具能力。放在最後，因為外部協定相容性風險最高、最需要獨立驗證。

**範圍：**
- MCP client：對 `streamable-http` 走 `initialize` → `notifications/initialized`（notification，無回應）→ `tools/list`／`tools/call` 的 JSON-RPC 交握流程，正確處理 session id（若 server 回傳）；`sse` transport 類似流程但走 SSE 回應解析。
- Settings 頁的 MCP Server 管理：新增時即時測試連線並快取可用 tool 清單；顯示「MCP Server 需允許瀏覽器跨來源請求」的提示（瀏覽器直連 MCP Server 受 CORS 限制，這是使用者需要自行確保的環境條件，非本系統可解決）。
- Bridge 的 `mcp.call`／`mcp.listTools`：依名稱容錯解析找到對應 Server（見第 6 節）。

**驗收清單：**
- [ ] 對一個真實、允許 CORS 的 MCP Server 新增設定，確認連線成功並列出可用 tools
- [ ] 生成一個呼叫 MCP tool 的工具，確認能正確取得結果
- [ ] 對不支援或不允許 CORS 的 Server，確認有清楚的錯誤訊息（而非靜默失敗或當機）
- [ ] MCP Server 名稱在生成程式碼中被 LLM 誤植（大小寫/空白差異）時，容錯解析仍能正確找到該 Server

---

### M11 — Deep Agent 引擎

**目標：** 提供第二套生成引擎——LLM 透過工具呼叫自主完成整個「讀資料→寫碼→自測→修錯」的迴圈，不受固定管線束縛。此里程碑依賴 M1（沙箱渲染）、M6（資料/storage）、M7（bridge 執行測試需要的沙箱環境）已完成。

**範圍：**
- LLM 串流客戶端需支援 **function calling**：請求時附上工具的 JSON Schema 定義；串流回應中的工具呼叫片段（可能分批送達）需正確累積組裝成完整的呼叫請求（含名稱與參數，參數是逐步累積的 JSON 字串直到完整）。
- Agent 迴圈：
  1. 送出「系統指示 + 對話 + 可用工具定義」給 LLM。
  2. 若回應含工具呼叫，逐一執行（工具的 `execute` 失敗、參數不是合法 JSON、呼叫了不存在的工具，都要把**錯誤訊息回饋給 LLM**，讓它有機會自行修正再試，而不是直接中止整個迴圈）。
  3. 把每個工具呼叫的結果餵回對話，回到步驟 1。
  4. 若 LLM 直接回覆純文字（無工具呼叫）或呼叫「結束」工具，迴圈結束。
  5. 設**最大步數上限**，超過時停止並告知使用者目前進度、可再送訊息繼續。
  6. 全程**可中止**（使用者按停止）。
- 最低限度的工具集：
  - `read_data`：讀取已綁定資料來源的格式與內容摘要（不帶名稱時回傳全部）。
  - `write_tool_code`：以完整 HTML 覆寫工作中的程式碼（首次或大改時用）。
  - `patch_tool_code`：對工作中程式碼做一次精確 find/replace（小改時用；find 需在目前程式碼中唯一存在，否則回錯誤讓 LLM 重新確認程式碼內容）。
  - `run_tool`：在**隱藏的沙箱 iframe** 中實際執行目前的工作程式碼一段時間（掛上真實 bridge），收集執行期錯誤並回報；沒有錯誤視為測試通過。
  - `finish`：結束迴圈，附上給使用者的簡短總結。
- UI：Agent 模式開關（於編輯頁工具列，跟原本的「生成工具」按鈕互斥顯示）；「Agent 活動」面板即時顯示每一步（呼叫哪個工具、對應的簡短描述、成功/失敗圖示）；迴圈結束時把工作中程式碼一次性提交為一個新版本。

**驗收清單：**
- [ ] 綁定一份資料來源，開啟 Agent 模式並要求做一個顯示該資料的工具，觀察活動面板依序出現「讀取資料 → 寫入程式碼 → 測試 → （若有錯誤）修正 → 結束」
- [ ] 刻意讓 LLM 一開始寫出有 bug 的程式碼（可用較弱的模型測試），確認 `run_tool` 能抓到錯誤、agent 自行修正後再測、最終產出可運作版本
- [ ] 中途按停止，確認迴圈正確中止、不會產生半途的版本
- [ ] 單元測試：以假的 chat 函式腳本化回應，驗證迴圈對「純文字回覆結束」「呼叫 finish」「工具執行失敗」「參數非法 JSON」「呼叫不存在的工具」「達到步數上限」各種情境的行為皆符合上述規則
- [ ] 單元測試：驗證串流中的工具呼叫片段能跨多個 chunk 正確組裝成完整呼叫

---

## 附錄 A：現行系統已知缺陷對照表

供對照，說明本規格書如何修正現行實作審查時發現的問題：

| # | 現行系統問題 | 本規格書對應章節 |
|---|---|---|
| 1 | API 認證標頭會外洩到匯出/分享檔 | 第 8 節安全需求、M9 驗收清單 |
| 2 | CI 只跑 build，未跑測試/lint，測試形同虛設 | 第 9 節、M0 範圍 |
| 3 | `bridge.llm.chat` 無用量防護，可被無限呼叫燒 API 額度 | 第 6 節「用量防護」、第 8 節、M7 驗收清單 |
| 4 | 單一頁面元件（`CreatePage`）扛所有生成邏輯，近 900 行、無法單元測試 | 第 9 節「元件與邏輯分離」 |
| 5 | 完全沒有 ESLint／Prettier | 第 2 節、第 9 節、M0 |
| 6 | Bridge 名稱解析、匯出/分享等核心邏輯缺乏單元測試 | 第 9 節「單元測試覆蓋範圍」 |
| 7 | 無障礙近乎空白（icon 按鈕無 `aria-label`）| 第 10 節 |
| 8 | 資料摘要對長內容做粗暴字元截斷，可能切壞第一筆資料的欄位結構 | M6「結構感知的內容摘要」 |
