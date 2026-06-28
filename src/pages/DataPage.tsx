import { useState, useEffect } from 'react'
import { Layout, Table, Button, Upload, message, Typography, Tag, Alert, Popconfirm, Modal, Space } from 'antd'
import { UploadOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons'
import AppHeader from '../components/AppHeader'
import { listFiles, writeFile, deleteFile, readFilePrefix, isOPFSSupported, OPFSFileInfo } from '../services/opfs'
import { parseData } from '../services/dataSource'

const { Content } = Layout

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

interface Preview {
  name: string
  rows?: Record<string, unknown>[]
  text?: string
}

export default function DataPage() {
  const [files, setFiles] = useState<OPFSFileInfo[]>([])
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const supported = isOPFSSupported()

  async function handlePreview(info: OPFSFileInfo) {
    try {
      const text = await readFilePrefix(info.path)
      const parsed = parseData(info.name, text)
      if (Array.isArray(parsed)) {
        setPreview({ name: info.name, rows: parsed.slice(0, 50) as Record<string, unknown>[] })
      } else {
        setPreview({ name: info.name, text: typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2) })
      }
    } catch {
      message.error('無法讀取檔案')
    }
  }

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
      width: 130,
      render: (_: unknown, record: OPFSFileInfo) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => handlePreview(record)} />
          <Popconfirm
            title={`刪除 ${record.name}？`}
            okText="刪除"
            okButtonProps={{ danger: true }}
            cancelText="取消"
            onConfirm={() => handleDelete(record.path, record.name)}
          >
            <Button danger size="small" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
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

        <Modal
          title={`預覽：${preview?.name ?? ''}`}
          open={!!preview}
          onCancel={() => setPreview(null)}
          footer={null}
          width={800}
        >
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            僅預覽檔案開頭一段{preview?.rows ? `（前 ${preview.rows.length} 列）` : ''}
          </Typography.Text>
          {preview?.rows ? (
            <Table
              style={{ marginTop: 8 }}
              size="small"
              dataSource={preview.rows.map((r, i) => ({ ...r, __i: i }))}
              rowKey="__i"
              columns={Object.keys(preview.rows[0] ?? {}).map((k) => ({
                title: k,
                dataIndex: k,
                ellipsis: true,
              }))}
              pagination={false}
              scroll={{ x: 'max-content', y: 400 }}
            />
          ) : (
            <pre style={{ marginTop: 8, maxHeight: 440, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
              {preview?.text}
            </pre>
          )}
        </Modal>
      </Content>
    </Layout>
  )
}
