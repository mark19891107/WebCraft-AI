# 實作 Roadmap（垂直切片版）

> 本文件**取代原 [實作計畫](superpowers/plans/2026-06-26-webcraft-ai.md) 的「執行順序」**，
> 改用「小功能堆疊（vertical slice）」方式進行：每個 Slice 都是一條端到端、可在 GitHub Pages 線上驗證的薄功能。
> 原計畫的 22 個 Task 內容仍是程式碼參考，只是被重新分組、重新排序。

## 設計原則

1. **每個 Slice 結束都能在 Pages 上看到/操作到新東西**，而不是只有內部程式碼變動。
2. **最高風險的整合（LLM 串流 → iframe 渲染）盡早做**，及早發現問題。
3. **最複雜、最不可控的外部整合（MCP）放最後**，獨立驗證。
4. 沿途**修掉 review 發現的缺陷**（見每個 Slice 的「⚠️ 注意」）。

---

## S0 — 基礎（✅ 已完成）

- ✅ Task 1 專案骨架（React + Vite + AntD + Hash Router）
- ✅ Task 22 GitHub Actions 部署（來源＝GitHub Actions，由 `main` 觸發）
- ✅ Task 2 共用型別

**驗證：** Pages 已可開啟，顯示深色首頁。

---

## S1 — App 外殼與導覽

**目標：** 五個頁面都有真正的 Layout 與可點擊導覽、空狀態。

- AppHeader（Task 10）
- 各頁套上 `Layout`＋標題＋空狀態（HomePage / SettingsPage / DataPage 的殼）

**驗證：** 點 Header 在各頁間切換，深色主題一致。

---

## S2 — LLM 設定可儲存（第一個有狀態的功能）

**目標：** 填入並持久化 LLM 設定。

- settingsStore + useSettings（Task 3 的 settings 部分）
- SettingsPage 的 LLM 區塊（Task 13 的 LLM 部分，先跳過 MCP）
- 測試連線按鈕（Task 5 的 `testConnection`）

**驗證：** 填 endpoint/key/model → 重整頁面 → 值還在；測試連線有回饋。
**⚠️ 注意：** UI 標示「API Key 以明文存在瀏覽器」；`testConnection` 改為盡量相容（`/models` 失敗時退化處理）。

---

## S3 — 工具庫的儲存與列表（先不接 LLM）

**目標：** 用「手動塞一段固定 HTML」證明儲存 / 卡片 / 刪除 / 持久化都通。

- toolsStore + useTools（Task 3 的 tools 部分）
- ToolCard + DataSourceBadge（Task 11）
- HomePage 網格 + 新增（先建立含 placeholder HTML 的工具）+ 刪除（Task 12 的列表部分）

**驗證：** 新增工具 → 首頁出現卡片 → 重整仍在 → 刪除生效。

---

## S4 — 核心主軸：對話 → LLM 串流 → 生成完整 HTML → iframe 預覽（首輪）⭐

**目標：** 打通整個系統的脊椎，第一個「會動」的版本。只做**首輪完整生成**，先不做 patch / 版本樹。

- llm 串流服務（Task 5）**含修掉跨-chunk 緩衝 bug**
- useLLMStream（Task 5）
- systemPrompt 首輪版（Task 19 的 `buildFirstTurnSystemPrompt`）
- patch.ts 的 `extractFullHtml` / `extractExplanation`（Task 6 的一部分）
- ChatPanel + ChatMessage（Task 15）
- BridgeIframe（Task 16）**先只負責把 HTML 寫入 srcdoc 渲染**，bridge 腳本下個 Slice 再加
- PreviewPanel 的 Tool 分頁（Task 18 的一部分）
- CreatePage 串起來（Task 20 的首輪部分）
- ToolPage 全頁渲染（Task 21）

**驗證：** 設定好 LLM → `/create` 輸入需求 → 看到串流文字 → iframe 出現生成的工具 → 儲存 → 首頁看到 → `/tool/:id` 全頁開啟。
**⚠️ 注意：** iframe `sandbox="allow-scripts"`；srcdoc 為 `null` origin。

---

## S5 — 版本歷史與增量 patch 編輯

**目標：** 多輪修改、版本樹、分支、Code 檢視。

- patch.ts 的 `parsePatches` / `applyPatches` + 單元測試（Task 6 其餘）
- systemPrompt 的 patch 版（Task 19 的 `buildPatchSystemPrompt`）
- 版本 snapshot 邏輯 + patch 套用失敗 fallback（Task 20 其餘）
- VersionTree（Task 17）
- PreviewPanel 的 Code 分頁 + highlight.js（Task 16 的 CodeViewer + Task 18 其餘）

**驗證：** 對同一工具多輪修改 → 出現版本樹 → 切換/分支/加標籤/刪除 → Code 分頁看得到原始碼。

---

## S6 — 資料來源（OPFS）+ bridge.data

**目標：** 上傳檔案、綁定工具、生成的工具讀得到資料。

- opfs 服務（Task 4）**含 feature-detect 與降級**
- DataPage（Task 14）
- CreatePage 底部選綁定資料來源
- bridge host handler 的 `data.read` + **內聯 bridge 腳本注入**（Task 8 的一部分）
  **⚠️ 重新定義資料契約**：CSV→解析 rows、JSON→物件，並提供 schema/預覽給 system prompt。

**驗證：** 上傳 CSV → 綁到工具 → 請 LLM 生成「讀取並顯示這份資料」的工具 → 真的讀得到。

---

## S7 — Bridge：llm 與 api 代理

**目標：** 生成的工具能回呼主頁面的 LLM 與外部 API。

- bridge 的 `llm.chat`（串流回傳）與 `api.fetch`（繞 CORS）（Task 8 其餘）

**驗證：** 生成一個「呼叫 LLM 摘要」或「抓某 API」的工具，能拿到結果。
**⚠️ 注意：** 對 `bridge.llm` 加使用提示/上限，避免用 API Key 爆量。

---

## S8 — 匯出 / 匯入

**目標：** `.webcraft.json` 分享。

- exportImport（Task 9）
- HomePage 的匯入、卡片的匯出（Task 12 其餘）

**驗證：** 匯出工具 → 清掉 → 匯入 → 還原（含版本歷史；大檔有警告、API Key 不外洩）。

---

## S9 — MCP（最後、獨立驗證）

**目標：** 連線 MCP Server 並讓工具呼叫 Tool。

- mcpClient（Task 7）**補上 `initialize`→`notifications/initialized` 握手**；釐清 SSE/Streamable-HTTP 與 CORS
- SettingsPage 的 MCP 區塊（Task 13 其餘）
- bridge 的 `mcp.call` / `mcp.listTools`（Task 8 其餘）

**驗證：** 對一個真實 MCP Server 連線、列出 tools、由生成的工具呼叫成功。
**⚠️ 注意：** 此 Slice 風險最高，建議先用一個已知可用的 MCP Server 驗證連線可行性，再接 UI。

---

## Slice → 原 Task 對照

| Slice | 涵蓋原 Task |
|-------|-------------|
| S0 | 1, 2, 22 |
| S1 | 10 |
| S2 | 3(settings), 5(testConnection), 13(LLM) |
| S3 | 3(tools), 11, 12(列表) |
| S4 | 5, 6(部分), 15, 16(部分), 18(部分), 19(首輪), 20(首輪), 21 |
| S5 | 6, 17, 18, 19(patch), 20 |
| S6 | 4, 8(data), 14 |
| S7 | 8(llm/api) |
| S8 | 9, 12(匯入匯出) |
| S9 | 7, 8(mcp), 13(MCP) |
