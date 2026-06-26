import { Tree, Button, Popconfirm, Space, Typography, Tag } from 'antd'
import { DeleteOutlined, TagOutlined } from '@ant-design/icons'
import type { DataNode } from 'antd/es/tree'
import { ToolDefinition, ToolVersion } from '../types'

interface Props {
  tool: ToolDefinition
  onSelect: (versionId: string) => void
  onDelete: (versionId: string) => void
  onLabel: (versionId: string, label: string) => void
}

function buildTree(
  versions: ToolVersion[],
  currentId: string,
  onDelete: (id: string) => void,
  onLabel: (id: string, label: string) => void,
): DataNode[] {
  const byParent = new Map<string | null, ToolVersion[]>()
  versions.forEach((v) => {
    const list = byParent.get(v.parentVersionId) ?? []
    list.push(v)
    byParent.set(v.parentVersionId, list)
  })

  function nodesFor(parentId: string | null): DataNode[] {
    const children = byParent.get(parentId) ?? []
    return children.map((v) => {
      const idx = versions.indexOf(v) + 1
      const time = new Date(v.createdAt).toLocaleTimeString()
      return {
        key: v.versionId,
        title: (
          <Space size={4} style={{ width: '100%', justifyContent: 'space-between' }}>
            <span>
              <Tag color={v.versionId === currentId ? 'blue' : 'default'} style={{ marginInlineEnd: 4 }}>
                v{idx}
              </Tag>
              <Typography.Text style={{ fontSize: 12 }}>{v.label || time}</Typography.Text>
            </span>
            <span onClick={(e) => e.stopPropagation()}>
              <Button
                type="text"
                size="small"
                icon={<TagOutlined />}
                onClick={() => {
                  const label = window.prompt('版本說明標籤', v.label ?? '')
                  if (label !== null) onLabel(v.versionId, label)
                }}
              />
              <Popconfirm
                title="刪除此版本及其所有子版本？"
                okText="刪除"
                okButtonProps={{ danger: true }}
                cancelText="取消"
                onConfirm={() => onDelete(v.versionId)}
              >
                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </span>
          </Space>
        ),
        children: nodesFor(v.versionId),
      }
    })
  }

  return nodesFor(null)
}

export default function VersionTree({ tool, onSelect, onDelete, onLabel }: Props) {
  if (tool.versions.length === 0) {
    return <Typography.Text type="secondary">尚無版本，生成後會自動建立。</Typography.Text>
  }

  const treeData = buildTree(tool.versions, tool.currentVersionId, onDelete, onLabel)

  return (
    <Tree
      treeData={treeData}
      selectedKeys={[tool.currentVersionId]}
      defaultExpandAll
      blockNode
      onSelect={(keys) => {
        const key = keys[0]
        if (typeof key === 'string') onSelect(key)
      }}
    />
  )
}
