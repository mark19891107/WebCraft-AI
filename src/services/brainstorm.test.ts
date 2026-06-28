import { describe, it, expect } from 'vitest'
import { parseBrainstorm } from './brainstorm'

describe('parseBrainstorm', () => {
  it('parses a json question block', () => {
    const text =
      '幾個問題：\n```json\n{"questions":[{"id":"q1","question":"格式?","type":"single","options":["CSV","手動"]}]}\n```'
    const form = parseBrainstorm(text)
    expect(form?.questions).toHaveLength(1)
    expect(form?.questions[0]).toMatchObject({ id: 'q1', type: 'single', options: ['CSV', '手動'] })
  })

  it('downgrades single/multi without options to text', () => {
    const text = '```json\n{"questions":[{"question":"風格?","type":"single"}]}\n```'
    expect(parseBrainstorm(text)?.questions[0].type).toBe('text')
  })

  it('returns null when no json block', () => {
    expect(parseBrainstorm('就是一般文字問句？')).toBeNull()
  })

  it('returns null on malformed json', () => {
    expect(parseBrainstorm('```json\n{ not valid }\n```')).toBeNull()
  })
})
