// 腦力激盪問題的結構化格式：LLM 以 ```json 區塊輸出，前端解析成可點選表單

export type QuestionType = 'single' | 'multi' | 'text'

export interface BrainstormQuestion {
  id: string
  question: string
  type: QuestionType
  options?: string[]
}

export interface BrainstormForm {
  intro?: string
  questions: BrainstormQuestion[]
}

function coerceQuestions(raw: unknown): BrainstormQuestion[] {
  if (!Array.isArray(raw)) return []
  const out: BrainstormQuestion[] = []
  raw.forEach((q, i) => {
    if (!q || typeof q !== 'object') return
    const obj = q as Record<string, unknown>
    const question = typeof obj.question === 'string' ? obj.question : ''
    if (!question) return
    let type: QuestionType = 'text'
    if (obj.type === 'single' || obj.type === 'multi' || obj.type === 'text') type = obj.type
    const options = Array.isArray(obj.options)
      ? obj.options.filter((o): o is string => typeof o === 'string')
      : undefined
    if ((type === 'single' || type === 'multi') && (!options || options.length === 0)) {
      type = 'text'
    }
    out.push({ id: typeof obj.id === 'string' ? obj.id : `q${i + 1}`, question, type, options })
  })
  return out
}

// 從 LLM 回應中解析腦力激盪表單；無結構化內容時回傳 null
export function parseBrainstorm(text: string): BrainstormForm | null {
  const fenced = text.match(/```json\s*\n([\s\S]*?)```/) ?? text.match(/```\s*\n(\{[\s\S]*?\})\s*```/)
  if (!fenced) return null
  try {
    const data = JSON.parse(fenced[1]) as Record<string, unknown>
    const questions = coerceQuestions(data.questions)
    if (questions.length === 0) return null
    return { intro: typeof data.intro === 'string' ? data.intro : undefined, questions }
  } catch {
    return null
  }
}
