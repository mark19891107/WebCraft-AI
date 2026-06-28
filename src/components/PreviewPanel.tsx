import { Tabs, Button, Popconfirm, Space } from 'antd'
import { ClearOutlined } from '@ant-design/icons'
import { ToolDefinition, ToolVersion } from '../types'
import BridgeIframe from './BridgeIframe'
import CodeViewer from './CodeViewer'
import VersionTree from './VersionTree'
import DiffViewer from './DiffViewer'

interface Props {
  tool: ToolDefinition
  currentVersion?: ToolVersion
  activeKey: string
  onChangeKey: (key: string) => void
  // 串流生成中的即時程式碼（覆蓋顯示於「程式碼」頁籤）
  liveCode?: string
  streaming?: boolean
  onToolError?: (message: string) => void
  onVersionSelect: (versionId: string) => void
  onVersionDelete: (versionId: string) => void
  onVersionLabel: (versionId: string, label: string) => void
  onPruneVersions: () => void
}

export default function PreviewPanel({
  tool,
  currentVersion,
  activeKey,
  onChangeKey,
  liveCode,
  streaming,
  onToolError,
  onVersionSelect,
  onVersionDelete,
  onVersionLabel,
  onPruneVersions,
}: Props) {
  const savedCode = currentVersion?.code ?? ''
  const codeForViewer = streaming ? liveCode ?? '' : savedCode
  const parentVersion = currentVersion?.parentVersionId
    ? tool.versions.find((v) => v.versionId === currentVersion.parentVersionId)
    : undefined

  return (
    <Tabs
      activeKey={activeKey}
      onChange={onChangeKey}
      style={{ height: '100%' }}
      tabBarStyle={{ paddingInline: 12, marginBottom: 0 }}
      items={[
        {
          key: 'tool',
          label: '預覽',
          style: { height: 'calc(100vh - 160px)' },
          children: <BridgeIframe code={savedCode} tool={tool} onError={onToolError} />,
        },
        {
          key: 'code',
          label: streaming ? '程式碼 ✍️' : '程式碼',
          style: { height: 'calc(100vh - 160px)' },
          children: <CodeViewer code={codeForViewer} streaming={streaming} />,
        },
        {
          key: 'diff',
          label: '差異',
          style: { height: 'calc(100vh - 160px)' },
          children: (
            <DiffViewer
              oldCode={parentVersion?.code ?? ''}
              newCode={savedCode}
              isRoot={!currentVersion?.parentVersionId}
            />
          ),
        },
        {
          key: 'versions',
          label: `版本 (${tool.versions.length})`,
          style: { height: 'calc(100vh - 160px)', overflow: 'auto', padding: 12 },
          children: (
            <Space direction="vertical" style={{ width: '100%' }}>
              {tool.versions.length > 1 && (
                <Popconfirm
                  title="只保留目前版本、刪除其餘所有版本？"
                  okText="精簡"
                  okButtonProps={{ danger: true }}
                  cancelText="取消"
                  onConfirm={onPruneVersions}
                >
                  <Button size="small" icon={<ClearOutlined />}>
                    精簡版本（只留目前）
                  </Button>
                </Popconfirm>
              )}
              <VersionTree
                tool={tool}
                onSelect={onVersionSelect}
                onDelete={onVersionDelete}
                onLabel={onVersionLabel}
              />
            </Space>
          ),
        },
      ]}
    />
  )
}
