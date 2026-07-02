import { ToolDefinition } from '../types'
import { injectBridge } from '../services/bridgeInject'
import { attachBridge } from '../services/bridge'

/**
 * 在隱藏的 sandbox iframe 中執行工具程式碼一小段時間，收集執行期錯誤。
 * 有掛上真實 bridge，工具內的 data/storage/llm 呼叫都可運作。
 */
export function testToolCode(code: string, tool: ToolDefinition, waitMs = 1800): Promise<string[]> {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('sandbox', 'allow-scripts')
    iframe.style.cssText = 'position:fixed;width:2px;height:2px;left:-9999px;border:0'

    const errors: string[] = []
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return
      const data = event.data
      if (data && data.__wcToolError) errors.push(String(data.message ?? 'Unknown error'))
    }
    window.addEventListener('message', onMessage)

    iframe.srcdoc = injectBridge(code)
    document.body.appendChild(iframe)
    const detachBridge = attachBridge(iframe, tool)

    setTimeout(() => {
      window.removeEventListener('message', onMessage)
      detachBridge()
      iframe.remove()
      resolve(errors)
    }, waitMs)
  })
}
