import { describe, it, expect } from 'vitest'
import { parsePatches, applyPatches, extractExplanation, extractFullHtml } from './patch'

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
})

describe('extractFullHtml', () => {
  it('extracts html from code block', () => {
    const response = '```html\n<html></html>\n```'
    expect(extractFullHtml(response)).toBe('<html></html>')
  })

  it('accepts raw html without code block', () => {
    expect(extractFullHtml('<!DOCTYPE html><html></html>')).toBe('<!DOCTYPE html><html></html>')
  })

  it('returns null when no html', () => {
    expect(extractFullHtml('no code here')).toBeNull()
  })
})
