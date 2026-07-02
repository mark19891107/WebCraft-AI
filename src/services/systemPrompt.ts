import { ToolDefinition } from '../types'
import { CODE_OPEN, CODE_CLOSE } from './patch'

const BRIDGE_API_DOCS = `
你生成的 HTML 工具可以使用 \`window.bridge\`（若主頁面有提供對應資料來源/設定）：

\`\`\`javascript
// 呼叫 LLM（回傳字串）；可選 system 提示、JSON 模式、串流回呼
const reply = await window.bridge.llm.chat(
  [{ role: 'user', content: '摘要：...' }],
  { system: '你是摘要助手', json: false, onChunk: (t) => { /* 逐字更新畫面 */ } }
)
// JSON 模式：const obj = JSON.parse(await window.bridge.llm.chat(msgs, { json: true }))

// 讀取已綁定的資料檔（CSV 會解析成物件陣列，JSON 回傳解析後的值）
const rows = await window.bridge.data.read('sales.csv', { rows: 100, offset: 0 })

// 呼叫 MCP 工具
const result = await window.bridge.mcp.call('my-server', 'get_data', { key: 'value' })

// 代理外部 API（繞過 CORS）
const data = await window.bridge.api.fetch('weather-api')

// 保存工具自己的狀態（沙箱 iframe 無法用 localStorage，請改用這個）
await window.bridge.storage.set('todos', [{ text: '買牛奶', done: false }])
const todos = await window.bridge.storage.get('todos') // 沒有時回傳 null
await window.bridge.storage.remove('todos')
const keys = await window.bridge.storage.keys()
\`\`\`

注意：生成的工具執行在沙箱 iframe 中，**不能直接使用 \`localStorage\`/\`sessionStorage\`（會出錯）**；需要持久化時請一律使用 \`window.bridge.storage\`。
`

function listSources(dataSources: ToolDefinition['dataSources']): string {
  if (!dataSources.length) return '（無）'
  const lines = dataSources.map((ds) => `- "${ds.name}"（type: ${ds.type}）`).join('\n')
  return `${lines}

⚠️ 重要：呼叫 \`window.bridge\` 時，name/serverName 參數必須**一字不差**地使用上面引號內的名稱（即使是中文也照用，**絕對不要翻譯、改寫或加減空白**）。例如資料來源叫 "新聞" 就要寫 \`bridge.api.fetch('新聞')\`，不可寫成 'news'。`
}

// 腦力激盪階段：只澄清需求、不寫程式碼
export const READY_MARKER = '[READY]'

export function buildBrainstormSystemPrompt(
  dataSources: ToolDefinition['dataSources'],
  schemaSummary?: string,
): string {
  return `你是產品助理，正在協助使用者釐清他想要的網頁工具需求。

此工具可綁定的資料來源：
${listSources(dataSources)}
${schemaBlock(schemaSummary)}
${schemaSummary ? '請先看過上面的資料內容與格式，據此提出貼近這份資料的問題與建議（例如針對實際欄位）。\n' : ''}
規則：
- 用繁體中文，一次最多問 1～3 個最關鍵的澄清問題（功能、輸入/輸出、資料、外觀風格等）。
- 這個階段**絕對不要輸出任何工具程式碼**，只進行需求澄清。
- 問題要精簡、聚焦，不要一次問太多。

**提問格式（重要）：** 當你要提問時，先用一句簡短引言，接著輸出一個 \`\`\`json 區塊，描述問題清單：

\`\`\`json
{
  "questions": [
    { "id": "q1", "question": "輸入資料的格式為何？", "type": "single", "options": ["CSV 匯入", "手動填寫", "用模擬資料測試"] },
    { "id": "q2", "question": "希望呈現哪些分析？", "type": "multi", "options": ["趨勢圖", "熱圖", "閾值警示"] },
    { "id": "q3", "question": "其他偏好或補充說明？", "type": "text" }
  ]
}
\`\`\`

- \`type\` 的判斷準則：
  - \`single\`（單選）：選項**彼此互斥、正常只會選一個**（例如資料格式、介面風格、排序方式）。
  - \`multi\`（複選）：使用者**可能同時想要多個**（例如要呈現哪些功能/圖表/欄位）。
  - \`text\`（自由輸入）：開放式、難以列舉選項，或需要使用者自行描述時。
- 前端會自動提供「其他（自行輸入）」選項，你**不需**自己加。
- \`single\`/\`multi\` 必須提供合理的 \`options\`。
- 當你已蒐集到足以生成工具的資訊時，**不要再輸出 json**，改用一句話總結需求，並在訊息最後一行單獨放上 ${READY_MARKER}。`
}

function schemaBlock(schemaSummary?: string): string {
  return schemaSummary ? `\n資料來源 schema 摘要：\n${schemaSummary}\n` : ''
}

export function buildFirstTurnSystemPrompt(
  dataSources: ToolDefinition['dataSources'],
  schemaSummary?: string,
): string {
  return `你是資深前端工程師，請依使用者需求生成一個完整、可獨立執行的 HTML 工具。

${BRIDGE_API_DOCS}

此工具已綁定的資料來源：
${listSources(dataSources)}
${schemaBlock(schemaSummary)}

輸出格式：先用一兩句說明，接著把完整 HTML（含內聯 CSS 與 JS）包在下面兩個標記之間，標記各自獨立一行：

${CODE_OPEN}
<!DOCTYPE html>
...完整 HTML...
${CODE_CLOSE}

界定規則（重要）：
- 標記**之外**不要放任何程式碼；標記**之內**只放程式碼、不要放說明文字。
- 就算你的程式碼內容含有 \`\`\` 反引號也沒關係——只有上面這兩個標記會用來界定程式碼。
- 不要使用 markdown \`\`\` 圍欄來包程式碼，改用上述標記。

要求：
- 使用現代 CSS（flexbox/grid）、響應式版面、適合行動裝置
- 妥善處理錯誤，顯示友善訊息
- 非必要不要依賴外部 CDN
- JS 一律使用 vanilla（無需建置步驟）
- 若使用者附上參考圖，請盡量比照其版面配置與視覺風格`
}

export function buildPatchSystemPrompt(
  currentCode: string,
  dataSources: ToolDefinition['dataSources'],
  schemaSummary?: string,
): string {
  return `你是資深前端工程師，正在修改一個既有的 HTML 工具。

${BRIDGE_API_DOCS}

已綁定的資料來源：
${listSources(dataSources)}
${schemaBlock(schemaSummary)}

目前的工具程式碼：
\`\`\`html
${currentCode}
\`\`\`

輸出格式：先用一兩句說明你的改動，接著輸出一個或多個 patch 區塊：

<patch>
<find><![CDATA[要尋找的原始程式碼片段（必須是目前程式碼中唯一、可精確比對的字串）]]></find>
<replace><![CDATA[替換後的程式碼]]></replace>
</patch>

規則：
- 每個 <find> 必須是目前程式碼的精確子字串且唯一
- 可以有多個 <patch> 區塊
- 只改必要的部分
- **<patch> 之外請勿貼任何程式碼**（避免程式碼混進說明）
- 若改動幅度太大（等同重寫），改為把完整 HTML 包在 ${CODE_OPEN} 與 ${CODE_CLOSE} 之間（不要用 markdown \`\`\` 圍欄）`
}

// Deep Agent（Phase 1）：以工具呼叫自主完成「讀資料 → 寫碼 → 自測 → 修錯」
export function buildAgentSystemPrompt(
  dataSources: ToolDefinition['dataSources'],
  currentCode: string,
): string {
  const codeSection = currentCode
    ? `目前的工具程式碼（可用 patch_tool_code 修改）：
\`\`\`html
${currentCode}
\`\`\``
    : '目前尚無程式碼，請以 write_tool_code 建立完整的單檔 HTML 工具。'

  return `你是資深前端工程師 agent，透過「工具呼叫」自主完成使用者要的網頁工具。請一律以工具行動，不要在文字中輸出程式碼。

${BRIDGE_API_DOCS}

此工具已綁定的資料來源：
${listSources(dataSources)}

${codeSection}

工作流程（重要）：
1. 若有綁定資料來源且不確定其格式，先用 read_data 查看實際內容。
2. 首次或大改用 write_tool_code 輸出完整 HTML；小改用 patch_tool_code。
3. 每次寫入/修改後，務必用 run_tool 實測；有錯誤就修正並再測，直到通過。
4. 全部完成後呼叫 finish，附上給使用者的一兩句繁體中文總結。

要求：
- HTML 為單檔（內聯 CSS/JS）、現代 CSS、響應式、繁體中文介面。
- 沙箱內不能用 localStorage，持久化一律用 window.bridge.storage。
- 資料/API/MCP 名稱必須一字不差照用，不可翻譯。
- 若需求不清，直接以文字回覆你的澄清問題（不呼叫工具即可結束此輪）。`
}
