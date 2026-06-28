import { useState } from 'react'
import { Card, Radio, Checkbox, Input, Button, Space, Typography, theme } from 'antd'
import { SendOutlined } from '@ant-design/icons'
import { BrainstormQuestion } from '../services/brainstorm'

const OTHER = '__other__'
const OTHER_LABEL = '其他（自行輸入）'

interface Props {
  questions: BrainstormQuestion[]
  disabled?: boolean
  onSubmit: (compiled: string) => void
}

interface AnswerState {
  single?: string
  multi: string[]
  text: string
  other: string
}

function emptyAnswer(): AnswerState {
  return { multi: [], text: '', other: '' }
}

export default function QuestionForm({ questions, disabled, onSubmit }: Props) {
  const { token } = theme.useToken()
  const [answers, setAnswers] = useState<Record<string, AnswerState>>(() =>
    Object.fromEntries(questions.map((q) => [q.id, emptyAnswer()])),
  )

  function update(id: string, patch: Partial<AnswerState>) {
    setAnswers((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  function isAnswered(q: BrainstormQuestion): boolean {
    const a = answers[q.id]
    if (!a) return false
    if (q.type === 'text') return a.text.trim() !== ''
    if (q.type === 'single') {
      if (a.single === OTHER) return a.other.trim() !== ''
      return !!a.single
    }
    // multi
    if (a.multi.length === 0) return false
    if (a.multi.includes(OTHER)) return a.other.trim() !== ''
    return true
  }

  function formatAnswer(q: BrainstormQuestion): string {
    const a = answers[q.id]
    if (q.type === 'text') return a.text.trim()
    if (q.type === 'single') return a.single === OTHER ? a.other.trim() : a.single ?? ''
    return a.multi.map((v) => (v === OTHER ? a.other.trim() : v)).join('、')
  }

  const allAnswered = questions.every(isAnswered)

  function submit() {
    const compiled = questions.map((q, i) => `${i + 1}. ${q.question} → ${formatAnswer(q)}`).join('\n')
    onSubmit(compiled)
  }

  return (
    <Card size="small" style={{ marginBottom: 12, borderColor: token.colorBorderSecondary }}>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {questions.map((q) => {
          const a = answers[q.id] ?? emptyAnswer()
          return (
            <div key={q.id}>
              <Typography.Text strong>{q.question}</Typography.Text>
              <div style={{ marginTop: 6 }}>
                {q.type === 'text' && (
                  <Input.TextArea
                    value={a.text}
                    disabled={disabled}
                    autoSize={{ minRows: 1, maxRows: 4 }}
                    placeholder="請輸入…"
                    onChange={(e) => update(q.id, { text: e.target.value })}
                  />
                )}

                {q.type === 'single' && (
                  <Radio.Group
                    value={a.single}
                    disabled={disabled}
                    onChange={(e) => update(q.id, { single: e.target.value })}
                  >
                    <Space direction="vertical">
                      {(q.options ?? []).map((opt) => (
                        <Radio key={opt} value={opt}>
                          {opt}
                        </Radio>
                      ))}
                      <Radio value={OTHER}>{OTHER_LABEL}</Radio>
                    </Space>
                  </Radio.Group>
                )}

                {q.type === 'multi' && (
                  <Checkbox.Group
                    value={a.multi}
                    disabled={disabled}
                    onChange={(vals) => update(q.id, { multi: vals as string[] })}
                  >
                    <Space direction="vertical">
                      {(q.options ?? []).map((opt) => (
                        <Checkbox key={opt} value={opt}>
                          {opt}
                        </Checkbox>
                      ))}
                      <Checkbox value={OTHER}>{OTHER_LABEL}</Checkbox>
                    </Space>
                  </Checkbox.Group>
                )}

                {((q.type === 'single' && a.single === OTHER) ||
                  (q.type === 'multi' && a.multi.includes(OTHER))) && (
                  <Input
                    style={{ marginTop: 6 }}
                    value={a.other}
                    disabled={disabled}
                    placeholder="請輸入其他…"
                    onChange={(e) => update(q.id, { other: e.target.value })}
                  />
                )}
              </div>
            </div>
          )
        })}

        <Button
          type="primary"
          icon={<SendOutlined />}
          disabled={disabled || !allAnswered}
          onClick={submit}
        >
          送出回答
        </Button>
      </Space>
    </Card>
  )
}
