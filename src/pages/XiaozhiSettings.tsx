import { useEffect, useState, useCallback } from 'react'
import {
  Card, Typography, Badge, Descriptions, Button, Space, Spin, Tag, Alert,
  Divider, Input, Form, message,
} from 'antd'
import {
  SyncOutlined, CheckCircleOutlined, CloseCircleOutlined, DisconnectOutlined,
  ApiOutlined, ThunderboltOutlined, SaveOutlined, PoweroffOutlined,
} from '@ant-design/icons'
import { getXiaozhiStatus, xiaozhiSetEndpoint, XiaozhiStatus } from '../services/mcp-client'

const { Title, Text, Paragraph } = Typography

const stateColor: Record<string, string> = {
  idle: 'default',
  connecting: 'processing',
  connected: 'warning',
  initialized: 'success',
  disconnected: 'error',
  failed: 'error',
}

const stateLabel: Record<string, string> = {
  idle: '空闲',
  connecting: '连接中',
  connected: '已连接',
  initialized: '已初始化',
  disconnected: '已断开',
  failed: '连接失败',
}

export default function XiaozhiSettings() {
  const [status, setStatus] = useState<XiaozhiStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [endpointInput, setEndpointInput] = useState('')
  const [endpointDirty, setEndpointDirty] = useState(false)
  const [messageApi, contextHolder] = message.useMessage()

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const s = await getXiaozhiStatus()
      setStatus(s)
      if (!endpointDirty) {
        setEndpointInput(s.endpoint || '')
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '获取状态失败')
    } finally {
      setLoading(false)
    }
  }, [endpointDirty])

  useEffect(() => {
    fetchStatus()
    const timer = setInterval(fetchStatus, 5000)
    return () => clearInterval(timer)
  }, [fetchStatus])

  const handleSave = async () => {
    try {
      setSaving(true)
      const result = await xiaozhiSetEndpoint(endpointInput.trim())
      if (result.success) {
        messageApi.success(
          endpointInput.trim()
            ? `已连接到: ${endpointInput.trim()}`
            : '已断开小智平台连接'
        )
        setEndpointDirty(false)
        await fetchStatus()
      } else {
        messageApi.error('设置失败')
      }
    } catch (e: unknown) {
      messageApi.error(e instanceof Error ? e.message : '设置失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDisconnect = async () => {
    try {
      setSaving(true)
      const result = await xiaozhiSetEndpoint('')
      if (result.success) {
        messageApi.success('已断开小智平台连接')
        setEndpointInput('')
        setEndpointDirty(false)
        await fetchStatus()
      }
    } catch (e: unknown) {
      messageApi.error(e instanceof Error ? e.message : '断开失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {contextHolder}
      <Space align="center" style={{ marginBottom: 16 }}>
        <ThunderboltOutlined style={{ fontSize: 24 }} />
        <Title level={3} style={{ margin: 0 }}>小智平台</Title>
      </Space>

      {error && (
        <Alert
          type="error"
          message="连接错误"
          description={error}
          showIcon
          closable
          style={{ marginBottom: 16 }}
        />
      )}

      <Card
        title={
          <Space>
            <ApiOutlined />
            <span>连接状态</span>
            {status && (
              <Badge
                status={
                  status.state === 'initialized' ? 'success' :
                  status.state === 'connected' ? 'warning' :
                  status.state === 'connecting' ? 'processing' : 'error'
                }
              />
            )}
          </Space>
        }
        extra={
          <Button
            icon={<SyncOutlined spin={loading} />}
            onClick={fetchStatus}
            loading={loading}
          >
            刷新
          </Button>
        }
      >
        {loading && !status ? (
          <Spin tip="加载中..." />
        ) : status ? (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="启用状态">
              {status.enabled ? (
                <Tag icon={<CheckCircleOutlined />} color="success">已启用</Tag>
              ) : (
                <Tag icon={<CloseCircleOutlined />} color="default">未启用</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="连接状态">
              <Tag color={stateColor[status.state] || 'default'}>
                {stateLabel[status.state] || status.state}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="当前端点">
              {status.endpoint ? (
                <Text copyable>{status.endpoint}</Text>
              ) : (
                <Text type="secondary">未配置</Text>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="WebSocket 连接">
              {status.connected ? (
                <Tag icon={<CheckCircleOutlined />} color="success">已连接</Tag>
              ) : (
                <Tag icon={<DisconnectOutlined />} color="default">未连接</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="MCP 初始化">
              {status.initialized ? (
                <Tag icon={<CheckCircleOutlined />} color="success">已完成</Tag>
              ) : (
                <Tag color="default">未初始化</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="桥接工具数">
              <Text strong>{status.bridged_tools}</Text>
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </Card>

      <Divider />

      <Card title="端点配置">
        <Form layout="vertical">
          <Form.Item
            label="WebSocket 端点"
            help="输入小智平台的 WebSocket 地址（ws:// 或 wss://），留空则禁用"
          >
            <Space.Compact style={{ width: '100%' }}>
              <Input
                placeholder="wss://your-xiaozhi-platform.com/ws"
                value={endpointInput}
                onChange={(e) => {
                  setEndpointInput(e.target.value)
                  setEndpointDirty(true)
                }}
                onPressEnter={handleSave}
                allowClear
              />
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={saving}
                onClick={handleSave}
              >
                {endpointInput.trim() ? '保存并连接' : '保存并禁用'}
              </Button>
            </Space.Compact>
          </Form.Item>
          {status?.enabled && (
            <Button
              danger
              icon={<PoweroffOutlined />}
              loading={saving}
              onClick={handleDisconnect}
            >
              断开连接
            </Button>
          )}
        </Form>
      </Card>

      <Divider />

      <Card title="工作原理" size="small">
        <Paragraph>
          小智平台通过 WebSocket 连接，将本地所有 MCP 工具桥接到小智 AI 平台，使 AI 助手能够控制米家设备、摄像头和音箱。
        </Paragraph>
        <Descriptions column={1} size="small">
          <Descriptions.Item label="协议">MCP (JSON-RPC 2.0) over WebSocket</Descriptions.Item>
          <Descriptions.Item label="角色">本服务作为 MCP Server，小智平台作为 MCP Client</Descriptions.Item>
          <Descriptions.Item label="自动重连">连接断开后自动重连（间隔可配置）</Descriptions.Item>
          <Descriptions.Item label="工具桥接">自动将所有已注册的 MCP 工具暴露给小智平台</Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  )
}
