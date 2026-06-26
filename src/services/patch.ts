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

// 取出說明文字（移除所有 <patch> 區塊後的內容）
export function extractExplanation(response: string): string {
  return response.replace(/<patch>[\s\S]*?<\/patch>/g, '').trim()
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
