# ⚡ WebCraft AI

> 純前端的 AI 網頁工具生成平台 — 用對話描述需求，讓 LLM 幫你生成可互動的網頁工具。

🔗 **線上版（Live Demo）：** https://mark19891107.github.io/WebCraft-AI/

WebCraft AI 讓使用者透過自然語言描述需求，由 LLM 即時生成可互動的網頁工具。工具可綁定外部資料來源（CSV/JSON、API、MCP Server），生成後儲存在瀏覽器本地，並可透過匯出 JSON 定義檔分享給他人。整個系統部署在 GitHub Pages，**完全不需要後端伺服器**。

## ✨ 特色

- 🗣️ **對話式生成** — 用自然語言描述需求，LLM streaming 即時生成完整 HTML 工具，可來回修改
- 🔌 **多元資料來源** — 綁定 CSV/JSON 檔案、外部 API、MCP Server
- 🌳 **樹狀版本歷史** — 每輪生成自動建立 snapshot，可從任意歷史版本分支繼續修改
- 🧩 **增量 patch 修改** — 後續修改只傳改動部分（`<patch>` 格式），節省 token
- 🔒 **安全沙箱** — 生成的工具跑在 sandboxed iframe，API Key 留在主頁面，iframe 無法取得
- 📦 **無帳號、無雲端** — 所有資料留在瀏覽器（localStorage + OPFS），透過 `.webcraft.json` 檔案分享
- 🚀 **零後端部署** — 純靜態網站，部署於 GitHub Pages

## 🏗️ 技術棧

| 項目 | 選擇 |
|------|------|
| 框架 | React 18 + TypeScript + Vite |
| UI 元件 | Ant Design 5（深色主題） |
| 路由 | React Router v6（Hash Router，相容 GitHub Pages 靜態部署） |
| 儲存 | localStorage（工具定義、設定）+ OPFS（大型資料檔，支援 2GB+） |
| 程式碼高亮 | highlight.js |
| 部署 | GitHub Pages + GitHub Actions（push to `main` 自動部署） |

## 📐 系統架構

WebCraft AI 是一個 single-page React 應用，採用 Hash Router。所有工具定義存在 localStorage，大型資料檔存在 OPFS。生成的工具在 sandboxed iframe 中執行，透過 `postMessage`（Bridge API）與主頁面通訊；LLM 呼叫一律由主頁面代理，API Key 永遠不會進入 iframe。

### Bridge API

生成的工具透過 `window.bridge` 物件呼叫主頁面能力：

```typescript
interface Bridge {
  llm:  { chat(messages, options?): Promise<string> }
  data: { read(name, options?): Promise<unknown> }
  mcp:  { call(serverName, tool, params): Promise<unknown>
          listTools(serverName): Promise<MCPTool[]> }
  api:  { fetch(name, options?): Promise<unknown> }
}
```

主頁面負責：代理 LLM 請求（持有 API Key）、從 OPFS 串流大型檔案、連接 MCP Server 並轉發結果、代理外部 API fetch（繞過 CORS）。

### 版本歷史（樹狀）

每次 LLM 完成一輪程式碼生成後自動建立一個 `ToolVersion` snapshot，透過 `parentVersionId` 連結成樹狀結構。使用者可切換到任意歷史版本並從該點分支繼續修改。

```
v1 (根)
├── v2 (加入折線圖)
│   ├── v3 (改成深色主題)
│   └── v4 (加上篩選器)
└── v5 (改用表格)
```

## 📄 頁面結構

| 路由 | 說明 |
|------|------|
| `/` | 首頁 — 工具庫卡片網格、新增/匯入/匯出/刪除 |
| `/create`、`/create/:id` | 建立/編輯工具 — 左側對話介面，右側 Tool/Code 預覽與版本歷史 |
| `/tool/:id` | 使用工具 — 全頁 iframe 渲染 |
| `/data` | 資料來源管理 — 上傳/刪除 OPFS 檔案 |
| `/settings` | 系統設定 — LLM endpoint/API Key/model、MCP Server 清單 |

## 🚀 快速開始

> ⚠️ 目前 repo 只包含設計規格與實作計畫文件，尚未產生實際程式碼。下列指令為實作完成後的預期使用方式。

```bash
# 安裝相依套件
npm install

# 啟動開發伺服器
npm run dev

# 建置正式版
npm run build

# 執行測試
npx vitest run
```

啟動後於 `/settings` 填入 LLM 設定（支援任何 OpenAI-compatible API 的 Endpoint、API Key、Model），即可開始建立工具。

## 🔗 分享機制

- **匯出**：點「匯出 JSON」下載 `.webcraft.json` 定義檔（小型檔案 < 10MB 以 base64 內嵌，API Key 不會被匯出）
- **匯入**：首頁點「匯入」上傳 `.webcraft.json`，系統解析後存入 localStorage

## 📚 文件

設計與實作細節請見：

- [設計規格](docs/superpowers/specs/2026-06-26-webcraft-ai-design.md)
- [實作計畫](docs/superpowers/plans/2026-06-26-webcraft-ai.md)

## 🎯 非目標（不在目前範圍）

- 帳號系統 / 雲端同步
- 協作編輯
- 行動裝置優化（以桌面為主）
