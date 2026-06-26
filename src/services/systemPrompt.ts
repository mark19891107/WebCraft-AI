import { ToolDefinition } from '../types'

const BRIDGE_API_DOCS = `
你生成的 HTML 工具可以使用 \`window.bridge\`（若主頁面有提供對應資料來源/設定）：

\`\`\`javascript
// 呼叫 LLM（回傳字串）
const reply = await window.bridge.llm.chat([{ role: 'user', content: '摘要：...' }])

// 讀取已綁定的資料檔（CSV 會解析成物件陣列，JSON 回傳解析後的值）
const rows = await window.bridge.data.read('sales.csv', { rows: 100, offset: 0 })

// 呼叫 MCP 工具
const result = await window.bridge.mcp.call('my-server', 'get_data', { key: 'value' })

// 代理外部 API（繞過 CORS）
const data = await window.bridge.api.fetch('weather-api')
\`\`\`
`

function listSources(dataSources: ToolDefinition['dataSources']): string {
  return dataSources.length
    ? dataSources.map((ds) => `- ${ds.name}（type: ${ds.type}）`).join('\n')
    : '（無）'
}

export function buildFirstTurnSystemPrompt(dataSources: ToolDefinition['dataSources']): string {
  return `你是資深前端工程師，請依使用者需求生成一個完整、可獨立執行的 HTML 工具。

${BRIDGE_API_DOCS}

此工具已綁定的資料來源：
${listSources(dataSources)}

輸出格式：先用一兩句說明，接著輸出完整 HTML（含內聯 CSS 與 JS）於 markdown code block：
\`\`\`html
<!DOCTYPE html>
...完整 HTML...
\`\`\`

要求：
- 使用現代 CSS（flexbox/grid）、響應式版面、適合行動裝置
- 妥善處理錯誤，顯示友善訊息
- 非必要不要依賴外部 CDN
- JS 一律使用 vanilla（無需建置步驟）`
}

export function buildPatchSystemPrompt(
  currentCode: string,
  dataSources: ToolDefinition['dataSources'],
): string {
  return `你是資深前端工程師，正在修改一個既有的 HTML 工具。

${BRIDGE_API_DOCS}

已綁定的資料來源：
${listSources(dataSources)}

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
