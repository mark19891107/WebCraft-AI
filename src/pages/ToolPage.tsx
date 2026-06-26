import { Button, Space, Result, Tooltip } from 'antd'
import { ArrowLeftOutlined, EditOutlined } from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import { getTool } from '../store/toolsStore'
import BridgeIframe from '../components/BridgeIframe'

export default function ToolPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const tool = id ? getTool(id) : undefined
  const currentVersion = tool?.versions.find((v) => v.versionId === tool.currentVersionId)

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
      <BridgeIframe code={currentVersion.code} title={tool.name} />
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
