import { useState } from 'react'
import { Button, Space, Result, Tooltip, Alert } from 'antd'
import { ArrowLeftOutlined, EditOutlined, BugOutlined } from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import { getTool } from '../store/toolsStore'
import BridgeIframe from '../components/BridgeIframe'

export default function ToolPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const tool = id ? getTool(id) : undefined
  const currentVersion = tool?.versions.find((v) => v.versionId === tool.currentVersionId)
  const [error, setError] = useState<string | null>(null)

  if (!tool || !currentVersion) {
    return (
      <Result
        status="404"
        title="找不到工具"
        subTitle="這個工具不存在，或尚未生成任何版本。"
        extra={
          <Button type="primary" onClick={() => navigate('/')}>
            回首頁
          </Button>
        }
      />
    )
  }

  return (
    <div style={{ position: 'relative', height: '100vh', overflow: 'hidden' }}>
      {error && (
        <Alert
          type="error"
          showIcon
          banner
          closable
          onClose={() => setError(null)}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20 }}
          message={`此工具執行時發生錯誤：${error}`}
          action={
            <Button
              size="small"
              danger
              icon={<BugOutlined />}
              onClick={() => navigate(`/create/${tool.id}`)}
            >
              編輯修復
            </Button>
          }
        />
      )}
      <BridgeIframe code={currentVersion.code} tool={tool} title={tool.name} onError={setError} />
      <Space style={{ position: 'absolute', top: 12, right: 12, zIndex: 10 }}>
        <Tooltip title="返回首頁">
          <Button shape="circle" icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} />
        </Tooltip>
        <Tooltip title="編輯">
          <Button shape="circle" icon={<EditOutlined />} onClick={() => navigate(`/create/${tool.id}`)} />
        </Tooltip>
      </Space>
    </div>
  )
}
