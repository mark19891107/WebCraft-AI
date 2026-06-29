import { ToolDefinition } from '../types'

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

export function buildBrainstormSystemPrompt(dataSources: ToolDefinition['dataSources']): string {
  return `你是產品助理，正在協助使用者釐清他想要的網頁工具需求。

此工具可綁定的資料來源：
${listSources(dataSources)}

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

- \`type\`：\`single\`=單選、\`multi\`=複選、\`text\`=自由輸入。前端會自動提供「其他（自行輸入）」選項，你**不需**自己加。
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

輸出格式：先用一兩句說明，接著輸出完整 HTML（含內聯 CSS 與 JS）於 markdown code block：
\`\`\`html
<!DOCTYPE html>
...完整 HTML...
\`\`\`

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
- 若改動幅度太大（等同重寫），改為直接輸出完整 HTML 於 markdown code block`
}
