export interface Patch {
  find: string
  replace: string
}

// 從 LLM 回應中擷取所有 <patch> 區塊
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

// 主要的程式碼界定哨符（幾乎不會出現在程式碼內容中，避免被程式碼裡的 ``` 假關閉）
export const CODE_OPEN = '@@@WEBCRAFT_CODE@@@'
export const CODE_CLOSE = '@@@END_WEBCRAFT_CODE@@@'

export interface SplitResult {
  explanation: string // 給人看的說明（不含程式碼/patch）
  code: string // 程式碼或 patch 內容（給「程式碼」頁籤即時呈現）
  inCode: boolean // 目前是否仍在未關閉的程式碼/patch 區（串流中）
}

// 程式碼區的界定方式（依優先序）：自訂哨符 → <patch> → markdown ``` 圍欄
interface Opener {
  open: string
  close: string
  keepMarkers: boolean // code 是否保留起訖標記（<patch> 需要保留給 parsePatches）
  afterNewline: boolean // 起始標記後略過同一行剩餘（``` 的語言標籤）
}

const OPENERS: Opener[] = [
  { open: CODE_OPEN, close: CODE_CLOSE, keepMarkers: false, afterNewline: false },
  { open: '<patch>', close: '</patch>', keepMarkers: true, afterNewline: false },
  { open: '```', close: '```', keepMarkers: false, afterNewline: true },
]

/**
 * 將（可能仍在串流、未完成的）LLM 回應分離成「說明」與「程式碼」兩部分。
 * 直接對「目前累積的完整字串」呼叫即可，毋須處理 chunk 邊界。
 */
export function splitStream(text: string): SplitResult {
  let explanation = ''
  let code = ''
  let inCode = false
  let pos = 0

  while (pos < text.length) {
    // 找出最靠前的起始標記
    let best = -1
    let opener: Opener | null = null
    for (const o of OPENERS) {
      const idx = text.indexOf(o.open, pos)
      if (idx !== -1 && (best === -1 || idx < best)) {
        best = idx
        opener = o
      }
    }
    if (best === -1 || !opener) {
      explanation += text.slice(pos)
      break
    }

    explanation += text.slice(pos, best)

    let contentStart = best + opener.open.length
    if (opener.afterNewline) {
      const nl = text.indexOf('\n', best)
      if (nl === -1) {
        // 起始標記所在行尚未結束（語言標籤還在串流）
        inCode = true
        break
      }
      contentStart = nl + 1
    }

    const closeIdx = text.indexOf(opener.close, contentStart)
    if (closeIdx === -1) {
      // 尚未關閉（串流中）
      code += opener.keepMarkers ? text.slice(best) : text.slice(contentStart)
      inCode = true
      break
    }
    code += opener.keepMarkers
      ? text.slice(best, closeIdx + opener.close.length)
      : text.slice(contentStart, closeIdx)
    pos = closeIdx + opener.close.length
  }

  // 串流中若說明結尾剛好是哨符的一部分（如 "@@@WEBCRA"），先不顯示，避免標記閃現在對話框
  return { explanation: stripTrailingPartial(explanation, CODE_OPEN).trim(), code, inCode }
}

function stripTrailingPartial(s: string, marker: string): string {
  for (let n = Math.min(marker.length - 1, s.length); n > 0; n--) {
    if (s.endsWith(marker.slice(0, n))) return s.slice(0, s.length - n)
  }
  return s
}

// 取出說明文字（移除所有程式碼區塊後的內容）
export function extractExplanation(response: string): string {
  return splitStream(response).explanation
}

// 取出完整 HTML：哨符 → markdown 圍欄 → 「整段就是 HTML」啟發式
export function extractFullHtml(response: string): string | null {
  // 1) 自訂哨符
  const open = response.indexOf(CODE_OPEN)
  if (open !== -1) {
    const start = open + CODE_OPEN.length
    const end = response.indexOf(CODE_CLOSE, start)
    const inner = (end === -1 ? response.slice(start) : response.slice(start, end)).trim()
    return inner || null
  }
  // 2) markdown 圍欄
  const match = response.match(/```(?:html)?\s*\n([\s\S]*?)```/i)
  if (match) return match[1].trim()
  // 3) 啟發式：從 <!doctype html> 或 <html ...> 擷取到 </html>
  const idx = response.search(/<!doctype html>|<html[\s>]/i)
  if (idx !== -1) {
    let html = response.slice(idx).trim()
    const endIdx = html.toLowerCase().lastIndexOf('</html>')
    if (endIdx !== -1) html = html.slice(0, endIdx + '</html>'.length)
    return html.trim() || null
  }
  return null
}

// 將 patch 套用到既有程式碼。任一 find 找不到時回傳 null。
export function applyPatches(code: string, patches: Patch[]): string | null {
  let result = code
  for (const patch of patches) {
    if (!result.includes(patch.find)) return null
    result = result.replace(patch.find, patch.replace)
  }
  return result
}

/**
 * 串流中即時呈現用：把目前已完成的 patch 套到 base 上，回傳套用後的完整程式碼。
 * - 說明階段（尚無完整 patch）→ 回傳 base（避免畫面空白看似卡住）。
 * - 找不到對應片段的 patch 會被略過（容忍串流中尚未對齊的情況）。
 * - 若回應改用完整 ``` 程式碼區塊（fallback 重寫），則回傳該程式碼。
 */
export function livePatchedCode(base: string, rawText: string): string {
  const patches = parsePatches(rawText)
  if (patches.length > 0) {
    let result = base
    for (const patch of patches) {
      if (result.includes(patch.find)) result = result.replace(patch.find, patch.replace)
    }
    return result
  }
  const full = extractFullHtml(rawText)
  if (full) return full
  return base
}
