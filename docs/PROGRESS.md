# 實作進度

執行順序改採 **[垂直切片 Roadmap](ROADMAP.md)**（小功能堆疊）；下表的 Task 編號沿用
[原實作計畫](superpowers/plans/2026-06-26-webcraft-ai.md) 作為程式碼參考。

**圖例：** ✅ 完成　🚧 進行中　⬜ 未開始

> 📌 部署策略：採「先打通 GitHub Pages 部署管線」優先，方便每一步都能線上驗證。
> 部署來源使用 **GitHub Actions**（官方 `actions/deploy-pages`，不經 `gh-pages` 分支）。
> 因 `github-pages` environment 預設只允許從 `main` 部署，部署改由 **push 到 `main`** 觸發。
> 開發仍在 `claude/repo-overview-zbalmv`，每次要線上驗證時將其合併進 `main`。

## 進度總覽

| # | Task | 狀態 | 備註 |
|---|------|------|------|
| 1 | Project Scaffold | ✅ | React + Vite + Ant Design，5 個 stub 頁面，build 通過 |
| 22 | GitHub Actions Deploy | ✅ | workflow 已建立（提前實作，供線上驗證）|
| 2 | TypeScript Types | ✅ | `src/types/index.ts`，tsc 通過 |
| 3 | Storage Layer | ⬜ | |
| 4 | OPFS Service | ⬜ | |
| 5 | LLM Streaming Service | ⬜ | |
| 6 | Patch Service | ⬜ | |
| 7 | MCP Client | ⬜ | |
| 8 | Bridge (postMessage) | ⬜ | |
| 9 | Export / Import Service | ⬜ | |
| 10 | AppHeader Component | ⬜ | |
| 11 | ToolCard & DataSourceBadge | ⬜ | |
| 12 | HomePage | ⬜ | 目前為簡化版 stub |
| 13 | SettingsPage | ⬜ | 目前為 stub |
| 14 | DataPage | ⬜ | 目前為 stub |
| 15 | ChatMessage & ChatPanel | ⬜ | |
| 16 | BridgeIframe & CodeViewer | ⬜ | |
| 17 | VersionTree Component | ⬜ | |
| 18 | PreviewPanel Component | ⬜ | |
| 19 | CreatePage — System Prompt Builder | ⬜ | |
| 20 | CreatePage | ⬜ | 目前為 stub |
| 21 | ToolPage | ⬜ | 目前為 stub |

## 變更紀錄

### 2026-06-26
- ✅ 新增專案 README
- ✅ **Task 1**：建立 React + Vite + Ant Design 專案骨架（TypeScript、Hash Router、深色主題、5 個路由 stub），`npm run build` 通過。
- ✅ **Task 22**：建立 GitHub Actions 部署 workflow（`peaceiris/actions-gh-pages`），觸發分支含開發分支，提前實作以便線上驗證後續每一步。
- 📝 新增本進度文件。
- ✅ **Task 2**：建立 `src/types/index.ts`，定義所有共用型別（Message、ToolDefinition、ToolVersion、DataSource、Settings、MCP、Bridge 通訊協定、匯出格式），`tsc --noEmit` 通過。
- 📝 新增 [垂直切片 Roadmap](ROADMAP.md)：重排實作順序為 S0–S9 小功能堆疊，並記錄 spec/計畫的待修缺陷（LLM 串流緩衝、bridge 內聯注入、MCP 握手、資料契約、安全提示等）。S0 已完成。

## 待使用者完成的一次性設定

Pages 已透過 workflow 的 `enablement: true` 自動開啟，來源為 **GitHub Actions**，無需手動設定。

部署成功後網站位於：`https://mark19891107.github.io/WebCraft-AI/`

> 舊的 `gh-pages` 分支已不再使用，可自行刪除。
