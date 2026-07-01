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

  it('truncates very long content', () => {
    const big = JSON.stringify({ blob: 'x'.repeat(2000) })
    expect(summarizeData('big.json', big)).toContain('已截斷')
  })
})
