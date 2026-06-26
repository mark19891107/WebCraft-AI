import { Tabs } from 'antd'
import { ToolDefinition, ToolVersion } from '../types'
import BridgeIframe from './BridgeIframe'
import CodeViewer from './CodeViewer'
import VersionTree from './VersionTree'

interface Props {
  tool: ToolDefinition
  currentVersion?: ToolVersion
  onVersionSelect: (versionId: string) => void
  onVersionDelete: (versionId: string) => void
  onVersionLabel: (versionId: string, label: string) => void
}

export default function PreviewPanel({
  tool,
  currentVersion,
  onVersionSelect,
  onVersionDelete,
  onVersionLabel,
}: Props) {
  const code = currentVersion?.code ?? ''

  return (
    <Tabs
      defaultActiveKey="tool"
      style={{ height: '100%' }}
      tabBarStyle={{ paddingInline: 12, marginBottom: 0 }}
      items={[
        {
          key: 'tool',
          label: '預覽',
          style: { height: 'calc(100vh - 160px)' },
          children: <BridgeIframe code={code} tool={tool} />,
        },
        {
          key: 'code',
          label: '程式碼',
          style: { height: 'calc(100vh - 160px)' },
          children: <CodeViewer code={code} />,
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
