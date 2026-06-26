import { useEffect, useState } from 'react'
import { Modal, Typography, Checkbox, Empty, Divider, Form, Input, Button, List, Space, Tag } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { DataSource, MCPServer } from '../types'
import { listFiles, isOPFSSupported, OPFSFileInfo } from '../services/opfs'

interface Props {
  open: boolean
  dataSources: DataSource[]
  mcpServers: MCPServer[]
  onClose: () => void
  onChange: (next: DataSource[]) => void
}

export default function DataSourceBinder({ open, dataSources, mcpServers, onClose, onChange }: Props) {
  const [files, setFiles] = useState<OPFSFileInfo[]>([])
  const [apiForm] = Form.useForm<{ name: string; url: string }>()

  useEffect(() => {
    if (open && isOPFSSupported()) listFiles('/data').then(setFiles)
  }, [open])

  const boundFileNames = new Set(
    dataSources.filter((d) => d.type === 'file').map((d) => d.name),
  )
  const apiSources = dataSources.filter((d) => d.type === 'api')
  const boundMcpRefs = new Set(
    dataSources.filter((d) => d.type === 'mcp').map((d) => d.serverRef),
  )

  function toggleMcp(server: MCPServer, checked: boolean) {
    const others = dataSources.filter((d) => !(d.type === 'mcp' && d.serverRef === server.id))
    if (checked) {
      onChange([...others, { type: 'mcp', name: server.name, serverRef: server.id }])
    } else {
      onChange(others)
    }
  }

  function toggleFile(info: OPFSFileInfo, checked: boolean) {
    const others = dataSources.filter((d) => !(d.type === 'file' && d.name === info.name))
    if (checked) {
      onChange([...others, { type: 'file', name: info.name, opfsPath: info.path }])
    } else {
      onChange(others)
    }
  }

  function addApi(values: { name: string; url: string }) {
    if (dataSources.some((d) => d.name === values.name)) return
    onChange([...dataSources, { type: 'api', name: values.name, url: values.url, headers: {} }])
    apiForm.resetFields()
  }

  function removeSource(name: string) {
    onChange(dataSources.filter((d) => d.name !== name))
  }

  return (
    <Modal title="綁定資料來源" open={open} onCancel={onClose} onOk={onClose} okText="完成" cancelText="關閉">
      <Typography.Title level={5}>已上傳的檔案（OPFS）</Typography.Title>
      {files.length === 0 ? (
        <Empty description="尚無檔案，請先到「資料來源」頁上傳" />
      ) : (
        <Space direction="vertical">
          {files.map((f) => (
            <Checkbox
              key={f.path}
              checked={boundFileNames.has(f.name)}
              onChange={(e) => toggleFile(f, e.target.checked)}
            >
              {f.name}
            </Checkbox>
          ))}
        </Space>
      )}

      <Divider />

      <Typography.Title level={5}>API 來源</Typography.Title>
      {apiSources.length > 0 && (
        <List
          size="small"
          dataSource={apiSources}
          renderItem={(d) => (
            <List.Item
              actions={[
                <Button
                  key="del"
                  type="text"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={() => removeSource(d.name)}
                />,
              ]}
            >
              <Tag color="green">{d.name}</Tag>
              <Typography.Text type="secondary" ellipsis style={{ maxWidth: 240 }}>
                {d.type === 'api' ? d.url : ''}
              </Typography.Text>
            </List.Item>
          )}
        />
      )}
      <Form form={apiForm} layout="inline" onFinish={addApi} style={{ marginTop: 8, rowGap: 8 }}>
        <Form.Item name="name" rules={[{ required: true, message: '名稱' }]}>
          <Input placeholder="名稱" style={{ width: 120 }} />
        </Form.Item>
        <Form.Item name="url" rules={[{ required: true, message: 'URL' }]}>
          <Input placeholder="https://api.example.com/..." style={{ width: 200 }} />
        </Form.Item>
        <Form.Item>
          <Button htmlType="submit" icon={<PlusOutlined />}>
            新增
          </Button>
        </Form.Item>
      </Form>

      <Divider />

      <Typography.Title level={5}>MCP Servers</Typography.Title>
      {mcpServers.length === 0 ? (
        <Empty description="尚未設定 MCP Server，請到「設定」頁新增" />
      ) : (
        <Space direction="vertical">
          {mcpServers.map((s) => (
            <Checkbox
              key={s.id}
              checked={boundMcpRefs.has(s.id)}
              onChange={(e) => toggleMcp(s, e.target.checked)}
            >
              {s.name}
            </Checkbox>
          ))}
        </Space>
      )}
    </Modal>
  )
}
