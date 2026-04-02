import { useEffect, useState, useCallback } from 'react'
import {
  Card, Typography, Space, Spin, Alert, Divider, Input, Select, Button,
  message, Tag, Descriptions, Empty, Switch, Form, InputNumber, Collapse,
  Modal, List, Popconfirm,
} from 'antd'
import {
  EyeOutlined, CameraOutlined, SendOutlined, RobotOutlined,
  SettingOutlined, SaveOutlined, ApiOutlined, PlusOutlined, DeleteOutlined,
} from '@ant-design/icons'
import {
  visionChat, VisionChatResult, getCameraList, CameraListResult,
  getVisionConfig, setVisionConfig, VisionConfigResult, VisionConfigUpdate,
} from '../services/mcp-client'
import { useAuthStore } from '../stores/authStore'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

interface ModelPreset {
  label: string
  value: string
  base_url: string
  custom?: boolean
}

const BUILTIN_PRESETS: ModelPreset[] = [
  { label: 'Qwen VL Max (通义千问)', value: 'qwen-vl-max', base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  { label: 'Qwen VL Plus (通义千问)', value: 'qwen-vl-plus', base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  { label: 'GPT-4o (OpenAI)', value: 'gpt-4o', base_url: 'https://api.openai.com/v1' },
  { label: 'GPT-4o Mini (OpenAI)', value: 'gpt-4o-mini', base_url: 'https://api.openai.com/v1' },
  { label: 'MiniMax-VL-01 (MiniMax)', value: 'MiniMax-VL-01', base_url: 'https://api.minimax.io/v1' },
  { label: 'MiniMax-M2.7 (MiniMax)', value: 'MiniMax-M2.7', base_url: 'https://api.minimax.io/v1' },
  { label: 'Doubao Vision Pro (豆包)', value: 'doubao-vision-pro-32k', base_url: 'https://ark.cn-beijing.volces.com/api/v3' },
  { label: 'LLaVA 13B (Ollama 本地)', value: 'llava:13b', base_url: 'http://localhost:11434/v1' },
  { label: 'LLaVA 7B (Ollama 本地)', value: 'llava:7b', base_url: 'http://localhost:11434/v1' },
]

const CUSTOM_MODELS_KEY = 'feyagate_custom_vlm_models'

function loadCustomModels(): ModelPreset[] {
  try {
    const raw = localStorage.getItem(CUSTOM_MODELS_KEY)
    if (!raw) return []
    return JSON.parse(raw).map((m: any) => ({ ...m, custom: true }))
  } catch {
    return []
  }
}

function saveCustomModels(models: ModelPreset[]) {
  localStorage.setItem(CUSTOM_MODELS_KEY, JSON.stringify(
    models.map(({ label, value, base_url }) => ({ label, value, base_url }))
  ))
}

export default function VisionSettings() {
  const serverOnline = useAuthStore((s) => s.serverOnline)

  // Config state
  const [config, setConfig] = useState<VisionConfigResult | null>(null)
  const [configLoading, setConfigLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [model, setModel] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [temperature, setTemperature] = useState(0)
  const [maxTokens, setMaxTokens] = useState(512)
  const [timeoutSeconds, setTimeoutSeconds] = useState(30)
  const [configDirty, setConfigDirty] = useState(false)

  // Custom models
  const [customModels, setCustomModels] = useState<ModelPreset[]>(() => loadCustomModels())
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newModel, setNewModel] = useState('')
  const [newBaseUrl, setNewBaseUrl] = useState('')

  const allPresets = [...BUILTIN_PRESETS, ...customModels]

  // Chat state
  const [cameras, setCameras] = useState<CameraListResult | null>(null)
  const [selectedCamera, setSelectedCamera] = useState<string>('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [cameraLoading, setCameraLoading] = useState(false)
  const [result, setResult] = useState<VisionChatResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [messageApi, contextHolder] = message.useMessage()

  const fetchConfig = useCallback(async () => {
    try {
      setConfigLoading(true)
      const cfg = await getVisionConfig()
      setConfig(cfg)
      setEnabled(cfg.enabled)
      setBaseUrl(cfg.base_url)
      setModel(cfg.model)
      setTemperature(cfg.temperature)
      setMaxTokens(cfg.max_tokens)
      setTimeoutSeconds(cfg.timeout_seconds)
      setApiKey('')
      setConfigDirty(false)
    } catch {
      // ignore
    } finally {
      setConfigLoading(false)
    }
  }, [])

  const fetchCameras = useCallback(async () => {
    try {
      setCameraLoading(true)
      const list = await getCameraList()
      setCameras(list)
      if (list.cameras.length > 0 && !selectedCamera) {
        setSelectedCamera(list.cameras[0].did)
      }
    } catch {
      // ignore
    } finally {
      setCameraLoading(false)
    }
  }, [selectedCamera])

  useEffect(() => {
    if (serverOnline) {
      fetchConfig()
      fetchCameras()
    }
  }, [serverOnline, fetchConfig, fetchCameras])

  const handleModelPreset = (modelValue: string) => {
    const preset = allPresets.find((p) => p.value === modelValue)
    setModel(modelValue)
    if (preset) setBaseUrl(preset.base_url)
    setConfigDirty(true)
  }

  const handleAddCustomModel = () => {
    if (!newLabel.trim() || !newModel.trim() || !newBaseUrl.trim()) {
      messageApi.warning('请填写完整的模型信息')
      return
    }
    if (allPresets.find((p) => p.value === newModel.trim())) {
      messageApi.warning('该模型 ID 已存在')
      return
    }
    const newPreset: ModelPreset = {
      label: newLabel.trim(),
      value: newModel.trim(),
      base_url: newBaseUrl.trim(),
      custom: true,
    }
    const updated = [...customModels, newPreset]
    setCustomModels(updated)
    saveCustomModels(updated)
    setAddModalOpen(false)
    setNewLabel('')
    setNewModel('')
    setNewBaseUrl('')
    messageApi.success('自定义模型已添加')

    setModel(newPreset.value)
    setBaseUrl(newPreset.base_url)
    setConfigDirty(true)
  }

  const handleDeleteCustomModel = (modelValue: string) => {
    const updated = customModels.filter((m) => m.value !== modelValue)
    setCustomModels(updated)
    saveCustomModels(updated)
    messageApi.success('已删除')
  }

  const handleSaveConfig = async () => {
    try {
      setSaving(true)
      const updates: VisionConfigUpdate = {
        enabled,
        base_url: baseUrl,
        model,
        temperature,
        max_tokens: maxTokens,
        timeout_seconds: timeoutSeconds,
      }
      if (apiKey.trim()) {
        updates.api_key = apiKey.trim()
      }
      const res = await setVisionConfig(updates)
      if (res.success) {
        messageApi.success(res.message)
        setConfig(res)
        setApiKey('')
        setConfigDirty(false)
      } else {
        messageApi.error(res.message || '保存失败')
      }
    } catch (e: unknown) {
      messageApi.error(e instanceof Error ? e.message : '保存配置失败')
    } finally {
      setSaving(false)
    }
  }

  const handleChat = async () => {
    if (!selectedCamera || !query.trim()) {
      messageApi.warning('请选择摄像头并输入问题')
      return
    }
    try {
      setLoading(true)
      setError(null)
      setResult(null)
      const r = await visionChat(selectedCamera, query.trim())
      if (r.error) {
        setError(r.error)
      } else {
        setResult(r)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Vision AI 调用失败')
    } finally {
      setLoading(false)
    }
  }

  if (!serverOnline) {
    return <Empty description="MCP Server 离线" />
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {contextHolder}
      <Space align="center" style={{ marginBottom: 16 }}>
        <EyeOutlined style={{ fontSize: 24 }} />
        <Title level={3} style={{ margin: 0 }}>Vision AI</Title>
      </Space>

      {/* Config Section */}
      <Card
        title={<Space><SettingOutlined /><span>模型配置</span></Space>}
        extra={
          <Space>
            <Tag color={config?.enabled ? 'green' : 'default'}>
              {config?.enabled ? '已启用' : '未启用'}
            </Tag>
            <Tag color={config?.has_api_key ? 'blue' : 'red'}>
              {config?.has_api_key ? `Key: ${config.api_key_masked}` : '未设置 Key'}
            </Tag>
          </Space>
        }
        loading={configLoading}
        style={{ marginBottom: 16 }}
      >
        <Form layout="vertical" size="middle">
          <Form.Item label="启用 Vision AI" style={{ marginBottom: 12 }}>
            <Switch
              checked={enabled}
              onChange={(v) => { setEnabled(v); setConfigDirty(true) }}
              checkedChildren="启用"
              unCheckedChildren="禁用"
            />
          </Form.Item>

          <Form.Item
            label="模型预设"
            style={{ marginBottom: 12 }}
            tooltip="选择预设会自动填充模型名称和 API 端点。支持所有 OpenAI 兼容接口。"
          >
            <Space.Compact style={{ width: '100%' }}>
              <Select
                placeholder="选择预设模型 (或手动填写下方字段)"
                allowClear
                style={{ flex: 1 }}
                value={allPresets.find((p) => p.value === model) ? model : undefined}
                onChange={handleModelPreset}
                options={[
                  {
                    label: '内置模型',
                    options: BUILTIN_PRESETS.map((p) => ({ value: p.value, label: p.label })),
                  },
                  ...(customModels.length > 0 ? [{
                    label: '自定义模型',
                    options: customModels.map((p) => ({
                      value: p.value,
                      label: `⭐ ${p.label}`,
                    })),
                  }] : []),
                ]}
              />
              <Button icon={<PlusOutlined />} onClick={() => setAddModalOpen(true)}>
                添加
              </Button>
            </Space.Compact>
          </Form.Item>

          {/* Custom models list */}
          {customModels.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>自定义模型：</Text>
              <div style={{ marginTop: 4 }}>
                {customModels.map((m) => (
                  <Tag
                    key={m.value}
                    closable
                    onClose={(e) => { e.preventDefault(); handleDeleteCustomModel(m.value) }}
                    style={{ marginBottom: 4 }}
                  >
                    {m.label} ({m.value})
                  </Tag>
                ))}
              </div>
            </div>
          )}

          <Form.Item label="模型名称" required style={{ marginBottom: 12 }}>
            <Input
              prefix={<RobotOutlined />}
              placeholder="例如: qwen-vl-max, gpt-4o, my-custom-model"
              value={model}
              onChange={(e) => { setModel(e.target.value); setConfigDirty(true) }}
            />
          </Form.Item>

          <Form.Item label="API 端点 (Base URL)" required style={{ marginBottom: 12 }}>
            <Input
              prefix={<ApiOutlined />}
              placeholder="https://your-api-endpoint.com/v1"
              value={baseUrl}
              onChange={(e) => { setBaseUrl(e.target.value); setConfigDirty(true) }}
            />
          </Form.Item>

          <Form.Item
            label="API Key"
            style={{ marginBottom: 12 }}
            tooltip={config?.has_api_key ? `当前 Key: ${config.api_key_masked}（留空保持不变）` : '需要设置 API Key 才能使用'}
          >
            <Input.Password
              placeholder={config?.has_api_key ? `当前: ${config.api_key_masked}（留空保持不变）` : '输入 API Key'}
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setConfigDirty(true) }}
            />
          </Form.Item>

          <Collapse
            ghost
            items={[{
              key: 'advanced',
              label: <Text type="secondary">高级参数</Text>,
              children: (
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Form.Item label="Temperature" style={{ marginBottom: 8 }} tooltip="0=确定性输出（推荐用于触发规则），较高值增加随机性">
                    <InputNumber
                      min={0} max={2} step={0.1}
                      value={temperature}
                      onChange={(v) => { setTemperature(v ?? 0); setConfigDirty(true) }}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                  <Form.Item label="最大 Token 数" style={{ marginBottom: 8 }}>
                    <InputNumber
                      min={64} max={4096} step={64}
                      value={maxTokens}
                      onChange={(v) => { setMaxTokens(v ?? 512); setConfigDirty(true) }}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                  <Form.Item label="HTTP 超时 (秒)" style={{ marginBottom: 8 }}>
                    <InputNumber
                      min={5} max={120}
                      value={timeoutSeconds}
                      onChange={(v) => { setTimeoutSeconds(v ?? 30); setConfigDirty(true) }}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Space>
              ),
            }]}
          />

          <Divider style={{ margin: '12px 0' }} />

          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            onClick={handleSaveConfig}
            disabled={!configDirty}
            block
          >
            {configDirty ? '保存配置' : '配置无变更'}
          </Button>
        </Form>
      </Card>

      {/* Add Custom Model Modal */}
      <Modal
        title="添加自定义模型"
        open={addModalOpen}
        onOk={handleAddCustomModel}
        onCancel={() => setAddModalOpen(false)}
        okText="添加"
        cancelText="取消"
        width={480}
      >
        <Alert
          type="info"
          showIcon
          message="支持所有兼容 OpenAI Chat Completions API 的视觉模型"
          style={{ marginBottom: 16 }}
        />
        <Form layout="vertical" size="middle">
          <Form.Item label="显示名称" required>
            <Input
              placeholder="例如: DeepSeek VL (自建)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
            />
          </Form.Item>
          <Form.Item label="模型 ID" required tooltip="对应 API 请求中的 model 字段">
            <Input
              prefix={<RobotOutlined />}
              placeholder="例如: deepseek-vl-7b"
              value={newModel}
              onChange={(e) => setNewModel(e.target.value)}
            />
          </Form.Item>
          <Form.Item label="API 端点 (Base URL)" required tooltip="OpenAI 兼容接口的基础地址">
            <Input
              prefix={<ApiOutlined />}
              placeholder="例如: https://your-api.com/v1"
              value={newBaseUrl}
              onChange={(e) => setNewBaseUrl(e.target.value)}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Chat Test Section */}
      <Card title={<Space><CameraOutlined /><span>摄像头画面问答</span></Space>}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {!config?.enabled && (
            <Alert type="warning" message="Vision AI 未启用，请先在上方配置中启用并保存。" showIcon />
          )}

          <div>
            <Text strong>选择摄像头</Text>
            <Select
              style={{ width: '100%', marginTop: 4 }}
              placeholder="选择要查看的摄像头"
              loading={cameraLoading}
              value={selectedCamera || undefined}
              onChange={setSelectedCamera}
              options={
                cameras?.cameras.map((c) => ({
                  value: c.did,
                  label: `${c.name} (${c.did})${c.camera_status === 'connected' ? ' ✓' : ''}`,
                })) ?? []
              }
            />
          </div>

          <div>
            <Text strong>输入问题</Text>
            <TextArea
              style={{ marginTop: 4 }}
              rows={3}
              placeholder="例如：现在有几个人在客厅？猫在做什么？"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onPressEnter={(e) => {
                if (!e.shiftKey) {
                  e.preventDefault()
                  handleChat()
                }
              }}
            />
          </div>

          <Button
            type="primary"
            icon={<SendOutlined />}
            loading={loading}
            onClick={handleChat}
            disabled={!selectedCamera || !query.trim() || !config?.enabled}
            block
          >
            发送提问
          </Button>
        </Space>
      </Card>

      {loading && (
        <Card style={{ marginTop: 16, textAlign: 'center' }}>
          <Spin tip="正在分析摄像头画面..." />
        </Card>
      )}

      {error && (
        <Alert
          type="error"
          message="调用失败"
          description={error}
          showIcon
          closable
          style={{ marginTop: 16 }}
        />
      )}

      {result && (
        <>
          <Divider />
          <Card
            title={<Space><RobotOutlined /><span>AI 分析结果</span></Space>}
          >
            <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="摄像头">
                {result.camera_name}
              </Descriptions.Item>
              <Descriptions.Item label="使用帧数">
                {result.images_used}
              </Descriptions.Item>
              {result.tokens && (
                <Descriptions.Item label="Token 用量">
                  <Tag>Prompt: {result.tokens.prompt}</Tag>
                  <Tag>Completion: {result.tokens.completion}</Tag>
                </Descriptions.Item>
              )}
            </Descriptions>
            <Card type="inner" style={{ background: '#f6f8fa' }}>
              <Paragraph style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                {result.content}
              </Paragraph>
            </Card>
          </Card>
        </>
      )}
    </div>
  )
}
