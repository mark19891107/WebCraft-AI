import { useState, useEffect } from 'react'
import { Layout, Table, Button, Upload, message, Typography, Tag, Alert, Popconfirm } from 'antd'
import { UploadOutlined, DeleteOutlined } from '@ant-design/icons'
import AppHeader from '../components/AppHeader'
import { listFiles, writeFile, deleteFile, isOPFSSupported, OPFSFileInfo } from '../services/opfs'

const { Content } = Layout

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export default function DataPage() {
  const [files, setFiles] = useState<OPFSFileInfo[]>([])
  const [uploading, setUploading] = useState(false)
  const supported = isOPFSSupported()

  async function loadFiles() {
    setFiles(await listFiles('/data'))
  }

  useEffect(() => {
    if (supported) loadFiles()
  }, [supported])

  async function handleUpload(file: File) {
    setUploading(true)
    try {
      await writeFile(`/data/${file.name}`, file)
      await loadFiles()
      message.success(`已上傳 ${file.name}`)
    } catch {
      message.error('上傳失敗')
    } finally {
      setUploading(false)
    }
    return false
  }

  async function handleDelete(path: string, name: string) {
    try {
      await deleteFile(path)
      await loadFiles()
      message.success(`已刪除 ${name}`)
    } catch {
      message.error('刪除失敗')
    }
  }

  const columns = [
    { title: '檔名', dataIndex: 'name' },
    {
      title: '大小',
      dataIndex: 'size',
      render: (size: number) => (
        <Tag color={size > 100 * 1024 * 1024 ? 'orange' : 'default'}>{formatSize(size)}</Tag>
      ),
    },
    {
      title: '操作',
      width: 100,
      render: (_: unknown, record: OPFSFileInfo) => (
        <Popconfirm
          title={`刪除 ${record.name}？`}
          okText="刪除"
          okButtonProps={{ danger: true }}
          cancelText="取消"
          onConfirm={() => handleDelete(record.path, record.name)}
        >
          <Button danger size="small" icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <AppHeader />
      <Content style={{ padding: 16, maxWidth: 960, margin: '0 auto', width: '100%' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
            marginBottom: 16,
            flexWrap: 'wrap',
          }}
        >
          <Typography.Title level={3} style={{ margin: 0 }}>
            資料來源管理
          </Typography.Title>
          <Upload accept=".csv,.json" showUploadList={false} beforeUpload={handleUpload} multiple disabled={!supported}>
            <Button icon={<UploadOutlined />} loading={uploading} disabled={!supported}>
              上傳 CSV / JSON
            </Button>
          </Upload>
        </div>

        {!supported && (
          <Alert
            style={{ marginBottom: 16 }}
            type="error"
            showIcon
            message="此瀏覽器不支援 OPFS"
            description="無法在本機儲存大型資料檔，請改用支援 OPFS 的瀏覽器（如 Chrome / Edge）。"
          />
        )}

        <Table
          dataSource={files}
          columns={columns}
          rowKey="path"
          pagination={false}
          locale={{ emptyText: '尚無資料檔案，請上傳 CSV 或 JSON' }}
          scroll={{ x: 'max-content' }}
        />
      </Content>
    </Layout>
  )
}
