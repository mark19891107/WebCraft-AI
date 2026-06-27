import { Tabs } from 'antd'
import { ToolDefinition, ToolVersion } from '../types'
import BridgeIframe from './BridgeIframe'
import CodeViewer from './CodeViewer'
import VersionTree from './VersionTree'

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
}: Props) {
  const savedCode = currentVersion?.code ?? ''
  const codeForViewer = streaming ? liveCode ?? '' : savedCode

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
          key: 'versions',
          label: `版本 (${tool.versions.length})`,
          style: { height: 'calc(100vh - 160px)', overflow: 'auto', padding: 12 },
          children: (
            <VersionTree
              tool={tool}
              onSelect={onVersionSelect}
              onDelete={onVersionDelete}
              onLabel={onVersionLabel}
            />
          ),
        },
      ]}
    />
  )
}
