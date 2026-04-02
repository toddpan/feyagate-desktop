import { useEffect, useState, useCallback } from 'react'
import {
  Card, Typography, Space, Button, Switch, Tag, Modal, Form, Input,
  Select, InputNumber, message, Empty, Popconfirm, Alert, Spin, List,
  Divider, Collapse,
} from 'antd'
import {
  PlusOutlined, DeleteOutlined, EditOutlined, ThunderboltOutlined,
  SyncOutlined, VideoCameraOutlined, SettingOutlined, SaveOutlined,
} from '@ant-design/icons'
import {
  triggerList, triggerCreate, triggerUpdate, triggerDelete, triggerToggle,
  getCameraList, TriggerRule, CameraListResult,
  getTriggerConfig, setTriggerConfig, TriggerConfigResult, TriggerConfigUpdate,
} from '../services/mcp-client'
import { useAuthStore } from '../stores/authStore'

const { Title, Text, Paragraph } = Typography

export default function TriggerRules() {
  const serverOnline = useAuthStore((s) => s.serverOnline)
  const [rules, setRules] = useState<TriggerRule[]>([])
  const [cameras, setCameras] = useState<CameraListResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<TriggerRule | null>(null)
  const [saving, setSaving] = useState(false)
  const [messageApi, contextHolder] = message.useMessage()
  const [form] = Form.useForm()

  // Trigger config state
  const [triggerCfg, setTriggerCfg] = useState<TriggerConfigResult | null>(null)
  const [cfgLoading, setCfgLoading] = useState(false)
  const [cfgSaving, setCfgSaving] = useState(false)
  const [cfgEnabled, setCfgEnabled] = useState(false)
  const [cfgInterval, setCfgInterval] = useState(2)
  const [cfgImgCount, setCfgImgCount] = useState(6)
  const [cfgMotionThreshold, setCfgMotionThreshold] = useState(5)
  const [cfgLogTtl, setCfgLogTtl] = useState(30)
  const [cfgMinInterval, setCfgMinInterval] = useState(10)
  const [cfgDirty, setCfgDirty] = useState(false)

  const fetchConfig = useCallback(async () => {
    try {
      setCfgLoading(true)
      const cfg = await getTriggerConfig()
      setTriggerCfg(cfg)
      setCfgEnabled(cfg.enabled)
      setCfgInterval(cfg.interval_seconds)
      setCfgImgCount(cfg.vision_img_count)
      setCfgMotionThreshold(cfg.motion_threshold)
      setCfgLogTtl(cfg.log_ttl_days)
      setCfgMinInterval(cfg.min_trigger_interval)
      setCfgDirty(false)
    } catch {
      // ignore
    } finally {
      setCfgLoading(false)
    }
  }, [])

  const fetchRules = useCallback(async () => {
    try {
      setLoading(true)
      const res = await triggerList()
      setRules(res.rules ?? [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchCameras = useCallback(async () => {
    try {
      const list = await getCameraList()
      setCameras(list)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (serverOnline) {
      fetchConfig()
      fetchRules()
      fetchCameras()
    }
  }, [serverOnline, fetchConfig, fetchRules, fetchCameras])

  const handleSaveConfig = async () => {
    try {
      setCfgSaving(true)
      const updates: TriggerConfigUpdate = {
        enabled: cfgEnabled,
        interval_seconds: cfgInterval,
        vision_img_count: cfgImgCount,
        motion_threshold: cfgMotionThreshold,
        log_ttl_days: cfgLogTtl,
        min_trigger_interval: cfgMinInterval,
      }
      const res = await setTriggerConfig(updates)
      if (res.success) {
        messageApi.success(res.message)
        setTriggerCfg(res)
        setCfgDirty(false)
      } else {
        messageApi.error(res.message || '保存失败')
      }
    } catch (e: unknown) {
      messageApi.error(e instanceof Error ? e.message : '保存配置失败')
    } finally {
      setCfgSaving(false)
    }
  }

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await triggerToggle(id, enabled)
      messageApi.success(enabled ? '规则已启用' : '规则已禁用')
      fetchRules()
    } catch (e: unknown) {
      messageApi.error(e instanceof Error ? e.message : '操作失败')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await triggerDelete(id)
      messageApi.success('规则已删除')
      fetchRules()
    } catch (e: unknown) {
      messageApi.error(e instanceof Error ? e.message : '删除失败')
    }
  }

  const openCreate = () => {
    setEditingRule(null)
    form.resetFields()
    setModalOpen(true)
  }

  const openEdit = (rule: TriggerRule) => {
    setEditingRule(rule)
    form.setFieldsValue({
      name: rule.name,
      cameras: rule.cameras,
      condition: rule.condition,
      interval: rule.filter?.interval,
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const payload: Partial<TriggerRule> = {
        name: values.name,
        cameras: values.cameras,
        condition: values.condition,
      }
      if (values.interval) {
        payload.filter = { interval: values.interval }
      }
      if (editingRule) {
        await triggerUpdate(editingRule.id, payload)
        messageApi.success('规则已更新')
      } else {
        await triggerCreate(payload)
        messageApi.success('规则已创建')
      }
      setModalOpen(false)
      fetchRules()
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'errorFields' in e) return
      messageApi.error(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (!serverOnline) {
    return <Empty description="MCP Server 离线" />
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {contextHolder}
      <Space align="center" style={{ marginBottom: 16 }}>
        <ThunderboltOutlined style={{ fontSize: 24 }} />
        <Title level={3} style={{ margin: 0 }}>触发规则</Title>
      </Space>

      {/* Engine Config */}
      <Card
        title={<Space><SettingOutlined /><span>触发引擎配置</span></Space>}
        extra={
          <Tag color={triggerCfg?.enabled ? 'green' : 'default'}>
            {triggerCfg?.enabled ? '引擎运行中' : '引擎未启用'}
          </Tag>
        }
        loading={cfgLoading}
        style={{ marginBottom: 16 }}
      >
        <Form layout="vertical" size="middle">
          <Form.Item label="启用触发引擎" style={{ marginBottom: 12 }}>
            <Space>
              <Switch
                checked={cfgEnabled}
                onChange={(v) => { setCfgEnabled(v); setCfgDirty(true) }}
                checkedChildren="启用"
                unCheckedChildren="禁用"
              />
              <Text type="secondary">
                启用后系统会定时分析摄像头画面，满足条件时自动执行动作
              </Text>
            </Space>
          </Form.Item>

          <Collapse
            ghost
            items={[{
              key: 'params',
              label: <Text type="secondary">引擎参数</Text>,
              children: (
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Form.Item label="检查间隔（秒）" style={{ marginBottom: 8 }} tooltip="每隔多少秒检查一次所有规则">
                    <InputNumber
                      min={1} max={60}
                      value={cfgInterval}
                      onChange={(v) => { setCfgInterval(v ?? 2); setCfgDirty(true) }}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                  <Form.Item label="每次分析帧数" style={{ marginBottom: 8 }} tooltip="每次 LLM 调用发送的摄像头帧数，越多上下文越丰富但消耗更多 Token">
                    <InputNumber
                      min={1} max={20}
                      value={cfgImgCount}
                      onChange={(v) => { setCfgImgCount(v ?? 6); setCfgDirty(true) }}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                  <Form.Item label="运动检测阈值" style={{ marginBottom: 8 }} tooltip="dHash 运动检测阈值，画面变化低于此值不会调用 AI（节省 API 成本）。越低越敏感">
                    <InputNumber
                      min={0} max={64}
                      value={cfgMotionThreshold}
                      onChange={(v) => { setCfgMotionThreshold(v ?? 5); setCfgDirty(true) }}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                  <Form.Item label="单规则最小触发间隔（秒）" style={{ marginBottom: 8 }} tooltip="同一规则两次触发之间的最小间隔">
                    <InputNumber
                      min={1} max={3600}
                      value={cfgMinInterval}
                      onChange={(v) => { setCfgMinInterval(v ?? 10); setCfgDirty(true) }}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                  <Form.Item label="日志保留天数" style={{ marginBottom: 8 }}>
                    <InputNumber
                      min={1} max={365}
                      value={cfgLogTtl}
                      onChange={(v) => { setCfgLogTtl(v ?? 30); setCfgDirty(true) }}
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
            loading={cfgSaving}
            onClick={handleSaveConfig}
            disabled={!cfgDirty}
            block
          >
            {cfgDirty ? '保存配置' : '配置无变更'}
          </Button>
        </Form>
      </Card>

      {!triggerCfg?.enabled && (
        <Alert
          type="warning"
          showIcon
          message="触发引擎未启用"
          description="请在上方配置中启用触发引擎，规则才会自动执行。"
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Rules List */}
      <Card
        title={`规则列表 (${rules.length})`}
        extra={
          <Space>
            <Button icon={<SyncOutlined spin={loading} />} onClick={fetchRules}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              新建规则
            </Button>
          </Space>
        }
      >
        {loading ? (
          <Spin tip="加载中..." />
        ) : rules.length === 0 ? (
          <Empty description="暂无触发规则" />
        ) : (
          <List
            itemLayout="horizontal"
            dataSource={rules}
            renderItem={(rule) => (
              <List.Item
                actions={[
                  <Switch
                    key="toggle"
                    checked={rule.enabled}
                    onChange={(checked) => handleToggle(rule.id, checked)}
                    checkedChildren="启用"
                    unCheckedChildren="禁用"
                  />,
                  <Button
                    key="edit"
                    icon={<EditOutlined />}
                    size="small"
                    onClick={() => openEdit(rule)}
                  />,
                  <Popconfirm
                    key="del"
                    title="确定删除此规则？"
                    onConfirm={() => handleDelete(rule.id)}
                  >
                    <Button icon={<DeleteOutlined />} size="small" danger />
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <VideoCameraOutlined
                      style={{ fontSize: 24, color: rule.enabled ? '#52c41a' : '#d9d9d9' }}
                    />
                  }
                  title={
                    <Space>
                      <Text strong>{rule.name}</Text>
                      <Tag color={rule.enabled ? 'green' : 'default'}>
                        {rule.enabled ? '运行中' : '已禁用'}
                      </Tag>
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={2}>
                      <Text type="secondary">条件: {rule.condition}</Text>
                      <Text type="secondary">
                        摄像头: {rule.cameras?.join(', ')}
                        {rule.filter?.interval ? ` | 间隔: ${rule.filter.interval}秒` : ''}
                      </Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        title={editingRule ? '编辑规则' : '新建触发规则'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        confirmLoading={saving}
        width={560}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="规则名称"
            rules={[{ required: true, message: '请输入规则名称' }]}
          >
            <Input placeholder="例如: 客厅有人开灯" />
          </Form.Item>

          <Form.Item
            name="cameras"
            label="关联摄像头"
            rules={[{ required: true, message: '请选择至少一个摄像头' }]}
          >
            <Select
              mode="multiple"
              placeholder="选择摄像头"
              options={
                cameras?.cameras.map((c) => ({
                  value: c.did,
                  label: c.name,
                })) ?? []
              }
            />
          </Form.Item>

          <Form.Item
            name="condition"
            label="触发条件（自然语言描述）"
            rules={[{ required: true, message: '请描述触发条件' }]}
          >
            <Input.TextArea
              rows={3}
              placeholder={'例如: 检测到有人进入客厅\n猫咪跳上了餐桌\n深夜有陌生人在窗外'}
            />
          </Form.Item>

          <Form.Item name="interval" label="最小触发间隔（秒）">
            <InputNumber min={5} max={3600} placeholder="60" style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Divider />

      <Card title="使用说明" size="small">
        <Paragraph>
          触发条件使用自然语言描述，Vision AI 大模型会分析摄像头画面判断是否满足条件。
          系统内置运动检测（dHash），画面无变化时不会调用 AI，节省 API 成本。
        </Paragraph>
      </Card>
    </div>
  )
}
