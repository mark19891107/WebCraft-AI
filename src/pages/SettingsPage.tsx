import { Layout, Form, Input, Button, Space, Typography, Alert, message } from 'antd'
import { ApiOutlined, SaveOutlined } from '@ant-design/icons'
import { useState } from 'react'
import AppHeader from '../components/AppHeader'
import { useSettings } from '../hooks/useSettings'
import { testConnection } from '../services/llm'
import { Settings } from '../types'

const { Content } = Layout

export default function SettingsPage() {
  const { settings, update } = useSettings()
  const [llmForm] = Form.useForm<Settings['llm']>()
  const [testing, setTesting] = useState(false)

  function handleSaveLLM(values: Settings['llm']) {
    update({ ...settings, llm: values })
    message.success('LLM 設定已儲存')
  }

  async function handleTestLLM() {
    const values = llmForm.getFieldsValue()
    if (!values.endpoint) {
      message.warning('請先填入 Endpoint URL')
      return
    }
    setTesting(true)
    const ok = await testConnection(values)
    setTesting(false)
    if (ok) message.success('連線成功')
    else message.error('連線失敗，請確認 Endpoint 與 API Key')
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <AppHeader />
      <Content style={{ padding: 16, maxWidth: 720, margin: '0 auto', width: '100%' }}>
        <Typography.Title level={3}>設定</Typography.Title>

        <Typography.Title level={4}>LLM 設定</Typography.Title>
        <Alert
          style={{ marginBottom: 16 }}
          type="warning"
          showIcon
          message="API Key 以明文儲存於此瀏覽器的 localStorage，請勿在共用裝置上使用。"
        />
        <Form form={llmForm} initialValues={settings.llm} onFinish={handleSaveLLM} layout="vertical">
          <Form.Item name="endpoint" label="Endpoint URL" rules={[{ required: true, message: '請輸入 Endpoint' }]}>
            <Input placeholder="https://api.openai.com/v1" />
          </Form.Item>
          <Form.Item name="apiKey" label="API Key" rules={[{ required: true, message: '請輸入 API Key' }]}>
            <Input.Password placeholder="sk-..." autoComplete="off" />
          </Form.Item>
          <Form.Item name="model" label="Model" rules={[{ required: true, message: '請輸入 Model' }]}>
            <Input placeholder="gpt-4o" />
          </Form.Item>
          <Space wrap>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
              儲存
            </Button>
            <Button icon={<ApiOutlined />} loading={testing} onClick={handleTestLLM}>
              測試連線
            </Button>
          </Space>
        </Form>
      </Content>
    </Layout>
  )
}
