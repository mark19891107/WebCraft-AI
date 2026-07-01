import { describe, it, expect } from 'vitest'
import { parseCsv, parseData, summarizeData } from './dataSource'

describe('parseCsv', () => {
  it('parses header + rows into objects', () => {
    expect(parseCsv('a,b\n1,2\n3,4')).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
    ])
  })

  it('handles quoted commas', () => {
    expect(parseCsv('name,note\n"Doe, John",hi')).toEqual([{ name: 'Doe, John', note: 'hi' }])
  })
})

describe('parseData', () => {
  it('parses .json to a value', () => {
    expect(parseData('x.json', '{"a":1}')).toEqual({ a: 1 })
  })
  it('parses .csv to rows', () => {
    expect(parseData('x.csv', 'a\n1')).toEqual([{ a: '1' }])
  })
})

describe('summarizeData', () => {
  it('summarizes a CSV with columns and sample', () => {
    const s = summarizeData('sales.csv', 'city,amount\nTaipei,100\nTokyo,200')
    expect(s).toContain('陣列')
    expect(s).toContain('city')
    expect(s).toContain('Taipei')
  })

  it('summarizes a JSON object with keys and sample content', () => {
    const s = summarizeData('config.json', '{"title":"News","items":[1,2,3]}')
    expect(s).toContain('JSON 物件')
    expect(s).toContain('title')
    expect(s).toContain('News')
  })

  it('shortens long string values but keeps every field name (huge first record)', () => {
    const data = JSON.stringify([{ id: 1, note: 'x'.repeat(2000), city: 'Taipei' }])
    const s = summarizeData('big.json', data)
    // 所有欄位名都看得到，包含在超長值之後的欄位
    expect(s).toContain('id')
    expect(s).toContain('note')
    expect(s).toContain('city')
    // 超長值被縮短
    expect(s).not.toContain('x'.repeat(500))
    expect(s).toContain('…')
  })

  it('caps sampled array length with a remainder note', () => {
    const data = JSON.stringify(Array.from({ length: 10 }, (_, i) => ({ n: i })))
    // 頂層是陣列，summarizeData 先 slice(0,2)，故此測試針對巢狀陣列
    const nested = JSON.stringify({ list: Array.from({ length: 10 }, (_, i) => i) })
    expect(summarizeData('n.json', nested)).toContain('共 10 筆')
    expect(summarizeData('a.json', data)).toContain('共 10 筆')
  })
})
