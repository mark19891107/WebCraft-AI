import { describe, it, expect } from 'vitest'
import { diffLines, diffStats } from './diff'

describe('diffLines', () => {
  it('marks unchanged lines as eq', () => {
    const d = diffLines('a\nb', 'a\nb')
    expect(d.every((l) => l.type === 'eq')).toBe(true)
  })

  it('detects an added line', () => {
    const d = diffLines('a\nc', 'a\nb\nc')
    expect(d).toContainEqual({ type: 'add', text: 'b' })
    expect(diffStats(d)).toEqual({ added: 1, removed: 0 })
  })

  it('detects a removed line', () => {
    const d = diffLines('a\nb\nc', 'a\nc')
    expect(d).toContainEqual({ type: 'del', text: 'b' })
    expect(diffStats(d)).toEqual({ added: 0, removed: 1 })
  })

  it('treats a change as del + add', () => {
    const d = diffLines('hello', 'world')
    expect(diffStats(d)).toEqual({ added: 1, removed: 1 })
  })
})
