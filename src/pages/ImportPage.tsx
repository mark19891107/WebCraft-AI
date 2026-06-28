import { useEffect, useRef, useState } from 'react'
import { Result, Button, Spin } from 'antd'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import { decodeShareData } from '../services/exportImport'
import { saveTool } from '../store/toolsStore'

export default function ImportPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [state, setState] = useState<'loading' | 'error'>('loading')
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    done.current = true
    const data = params.get('d')
    if (!data) {
      setState('error')
      return
    }
    try {
      const tool = decodeShareData(data)
      tool.id = uuidv4()
      saveTool(tool)
      navigate(`/tool/${tool.id}`, { replace: true })
    } catch {
      setState('error')
    }
  }, [params, navigate])

  if (state === 'error') {
    return (
      <Result
        status="error"
        title="匯入失敗"
        subTitle="分享連結無效或已損毀。"
        extra={
          <Button type="primary" onClick={() => navigate('/')}>
            回首頁
          </Button>
        }
      />
    )
  }

  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}>
      <Spin size="large" tip="匯入中…" />
    </div>
  )
}
