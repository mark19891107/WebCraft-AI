export interface DiffLine {
  type: 'eq' | 'add' | 'del'
  text: string
}

// 以 LCS 做行級差異比對
export function diffLines(a: string, b: string): DiffLine[] {
  const aL = a.length ? a.split('\n') : []
  const bL = b.length ? b.split('\n') : []
  const n = aL.length
  const m = bL.length

  // 過大時退化：直接全刪全加，避免 O(n*m) 記憶體爆掉
  if (n > 3000 || m > 3000) {
    return [
      ...aL.map((text): DiffLine => ({ type: 'del', text })),
      ...bL.map((text): DiffLine => ({ type: 'add', text })),
    ]
  }

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = aL[i] === bL[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (aL[i] === bL[j]) {
      out.push({ type: 'eq', text: aL[i] })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: 'del', text: aL[i] })
      i++
    } else {
      out.push({ type: 'add', text: bL[j] })
      j++
    }
  }
  while (i < n) out.push({ type: 'del', text: aL[i++] })
  while (j < m) out.push({ type: 'add', text: bL[j++] })
  return out
}

export function diffStats(lines: DiffLine[]): { added: number; removed: number } {
  return lines.reduce(
    (acc, l) => {
      if (l.type === 'add') acc.added++
      else if (l.type === 'del') acc.removed++
      return acc
    },
    { added: 0, removed: 0 },
  )
}
