import { describe, it, expect } from 'vitest'
import { parsePatches, applyPatches, extractExplanation, extractFullHtml, splitStream } from './patch'

describe('parsePatches', () => {
  it('parses a single patch block', () => {
    const response = `Some text\n<patch><find><![CDATA[hello]]></find><replace><![CDATA[world]]></replace></patch>`
    expect(parsePatches(response)).toEqual([{ find: 'hello', replace: 'world' }])
  })

  it('parses multiple patch blocks', () => {
    const response = `
<patch><find><![CDATA[a]]></find><replace><![CDATA[b]]></replace></patch>
<patch><find><![CDATA[c]]></find><replace><![CDATA[d]]></replace></patch>`
    expect(parsePatches(response)).toHaveLength(2)
  })

  it('returns empty array when no patches', () => {
    expect(parsePatches('just text')).toEqual([])
  })
})

describe('applyPatches', () => {
  it('replaces matching text', () => {
    const result = applyPatches('<div>hello</div>', [{ find: 'hello', replace: 'world' }])
    expect(result).toBe('<div>world</div>')
  })

  it('returns null when find string not found', () => {
    const result = applyPatches('<div>hello</div>', [{ find: 'missing', replace: 'x' }])
    expect(result).toBeNull()
  })
})

describe('extractExplanation', () => {
  it('removes patch blocks from text', () => {
    const response = `Adding a chart.\n<patch><find><![CDATA[x]]></find><replace><![CDATA[y]]></replace></patch>`
    expect(extractExplanation(response)).toBe('Adding a chart.')
  })

  it('removes html code fences (first-turn)', () => {
    const response = '我做了一個計時器。\n```html\n<!DOCTYPE html><html></html>\n```'
    expect(extractExplanation(response)).toBe('我做了一個計時器。')
  })
})

describe('splitStream', () => {
  it('separates explanation and sentinel code', () => {
    const r = splitStream('做好了。\n@@@WEBCRAFT_CODE@@@\n<h1>hi</h1>\n@@@END_WEBCRAFT_CODE@@@')
    expect(r.explanation).toBe('做好了。')
    expect(r.code.trim()).toBe('<h1>hi</h1>')
    expect(r.inCode).toBe(false)
  })

  it('keeps code that contains triple backticks intact (sentinel)', () => {
    const code = '<pre>```js\nconst a=1\n```</pre>'
    const r = splitStream(`說明\n@@@WEBCRAFT_CODE@@@\n${code}\n@@@END_WEBCRAFT_CODE@@@`)
    expect(r.explanation).toBe('說明')
    expect(r.code).toContain('```js')
    expect(r.code).toContain('</pre>')
    expect(r.inCode).toBe(false)
  })

  it('marks inCode when sentinel is still open (streaming)', () => {
    const r = splitStream('生成中…\n@@@WEBCRAFT_CODE@@@\n<h1>partial')
    expect(r.explanation).toBe('生成中…')
    expect(r.code).toContain('<h1>partial')
    expect(r.inCode).toBe(true)
  })

  it('separates explanation and fenced code (fallback)', () => {
    const r = splitStream('做好了。\n```html\n<h1>hi</h1>\n```')
    expect(r.explanation).toBe('做好了。')
    expect(r.code.trim()).toBe('<h1>hi</h1>')
    expect(r.inCode).toBe(false)
  })

  it('marks inCode when fence is still open (streaming)', () => {
    const r = splitStream('生成中…\n```html\n<h1>partial')
    expect(r.explanation).toBe('生成中…')
    expect(r.code).toContain('<h1>partial')
    expect(r.inCode).toBe(true)
  })

  it('routes patch blocks to code, keeps prose as explanation', () => {
    const r = splitStream('改一下。\n<patch><find><![CDATA[a]]></find><replace><![CDATA[b]]></replace></patch>')
    expect(r.explanation).toBe('改一下。')
    expect(r.code).toContain('<patch>')
    expect(r.inCode).toBe(false)
  })
})

describe('extractFullHtml', () => {
  it('extracts html from sentinels', () => {
    const response = '說明\n@@@WEBCRAFT_CODE@@@\n<html></html>\n@@@END_WEBCRAFT_CODE@@@'
    expect(extractFullHtml(response)).toBe('<html></html>')
  })

  it('extracts sentinel code containing backticks', () => {
    const response = '@@@WEBCRAFT_CODE@@@\n<html>```</html>\n@@@END_WEBCRAFT_CODE@@@'
    expect(extractFullHtml(response)).toBe('<html>```</html>')
  })

  it('extracts html from code block (fallback)', () => {
    const response = '```html\n<html></html>\n```'
    expect(extractFullHtml(response)).toBe('<html></html>')
  })

  it('accepts raw html with leading prose (heuristic)', () => {
    expect(extractFullHtml('這是你的工具：<!DOCTYPE html><html></html>')).toBe(
      '<!DOCTYPE html><html></html>',
    )
  })

  it('returns null when no html', () => {
    expect(extractFullHtml('no code here')).toBeNull()
  })
})
