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

export interface SplitResult {
  explanation: string // 給人看的說明（不含程式碼/patch）
  code: string // 程式碼或 patch 內容（給「程式碼」頁籤即時呈現）
  inCode: boolean // 目前是否仍在未關閉的程式碼/patch 區（串流中）
}

/**
 * 將（可能仍在串流、未完成的）LLM 回應分離成「說明」與「程式碼」兩部分。
 * 程式碼區界定為 markdown ``` 圍欄 或 <patch>...</patch> 區塊。
 * 直接對「目前累積的完整字串」呼叫即可，毋須處理 chunk 邊界。
 */
export function splitStream(text: string): SplitResult {
  let explanation = ''
  let code = ''
  let inCode = false
  let pos = 0

  while (pos < text.length) {
    const fenceIdx = text.indexOf('```', pos)
    const patchIdx = text.indexOf('<patch>', pos)

    let nextIdx = -1
    let kind: 'fence' | 'patch' | null = null
    if (fenceIdx !== -1 && (patchIdx === -1 || fenceIdx < patchIdx)) {
      nextIdx = fenceIdx
      kind = 'fence'
    } else if (patchIdx !== -1) {
      nextIdx = patchIdx
      kind = 'patch'
    }

    if (nextIdx === -1) {
      explanation += text.slice(pos)
      break
    }

    explanation += text.slice(pos, nextIdx)

    if (kind === 'fence') {
      const nlIdx = text.indexOf('\n', nextIdx)
      if (nlIdx === -1) {
        // 開頭圍欄尚未換行（語言標籤還在串流），先視為即將進入程式碼
        inCode = true
        break
      }
      const closeIdx = text.indexOf('```', nlIdx + 1)
      if (closeIdx === -1) {
        code += text.slice(nlIdx + 1)
        inCode = true
        break
      }
      code += text.slice(nlIdx + 1, closeIdx)
      pos = closeIdx + 3
    } else {
      const closeIdx = text.indexOf('</patch>', nextIdx)
      if (closeIdx === -1) {
        code += text.slice(nextIdx)
        inCode = true
        break
      }
      code += text.slice(nextIdx, closeIdx + '</patch>'.length)
      pos = closeIdx + '</patch>'.length
    }
  }

  return { explanation: explanation.trim(), code, inCode }
}

// 取出說明文字（移除所有程式碼圍欄與 <patch> 區塊後的內容）
export function extractExplanation(response: string): string {
  return splitStream(response).explanation
}

// 從含 markdown code block 的回應中取出完整 HTML
export function extractFullHtml(response: string): string | null {
  const match = response.match(/```(?:html)?\s*\n([\s\S]*?)```/)
  if (match) return match[1].trim()
  // 沒有 code block 但整段看起來就是 HTML 時，直接採用
  const trimmed = response.trim()
  if (/^<!doctype html>/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) return trimmed
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
