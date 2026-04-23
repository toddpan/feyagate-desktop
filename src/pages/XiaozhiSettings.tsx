import { useEffect, useState, useCallback } from 'react'
import {
  Card, Typography, Badge, Button, Space, Spin, Tag, Alert,
  Divider, Input, Form, message, List, Popconfirm, Empty, Modal,
} from 'antd'
import {
  SyncOutlined, CheckCircleOutlined, CloseCircleOutlined, DisconnectOutlined,
  ApiOutlined, ThunderboltOutlined, PlusOutlined, DeleteOutlined,
} from '@ant-design/icons'
import {
  getXiaozhiStatus,
  xiaozhiAdd, xiaozhiRemove,
  XiaozhiStatus, XiaozhiClientInfo,
} from '../services/mcp-client'

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

function ClientCard({
  info,
  onRemove,
  removing,
}: {
  info: XiaozhiClientInfo
  onRemove: (index: number) => void
  removing: boolean
}) {
  const shortEndpoint = info.endpoint.length > 60
    ? info.endpoint.slice(0, 30) + '...' + info.endpoint.slice(-20)
    : info.endpoint

  return (
    <List.Item
      actions={[
        <Popconfirm
          key="del"
          title="确认删除此连接？"
          onConfirm={() => onRemove(info.index)}
          okText="删除"
          cancelText="取消"
          okButtonProps={{ danger: true }}
        >
          <Button
            danger
            size="small"
            icon={<DeleteOutlined />}
            loading={removing}
          >
            删除
          </Button>
        </Popconfirm>,
      ]}
    >
      <List.Item.Meta
        avatar={
          <Badge
            status={
              info.state === 'initialized' ? 'success' :
              info.state === 'connected' ? 'warning' :
              info.state === 'connecting' ? 'processing' : 'error'
            }
          />
        }
        title={
          <Space>
            <Text strong>连接 #{info.index + 1}</Text>
            <Tag color={stateColor[info.state] || 'default'} style={{ margin: 0 }}>
              {stateLabel[info.state] || info.state}
            </Tag>
            {info.initialized && (
              <Tag color="blue" style={{ margin: 0 }}>
                {info.bridged_tools} 工具
              </Tag>
            )}
          </Space>
        }
        description={
          <Text
            copyable={{ text: info.endpoint }}
            type="secondary"
            style={{ wordBreak: 'break-all', fontSize: 12 }}
          >
            {shortEndpoint}
          </Text>
        }
      />
    </List.Item>
  )
}

export default function XiaozhiSettings() {
  const [status, setStatus] = useState<XiaozhiStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [addModalOpen, setAddModalOpen] = useState(false)
  const [addEndpoint, setAddEndpoint] = useState('')
  const [adding, setAdding] = useState(false)

  const [removingIdx, setRemovingIdx] = useState<number | null>(null)

  const [messageApi, contextHolder] = message.useMessage()

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const s = await getXiaozhiStatus()
      setStatus(s)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '获取状态失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    const timer = setInterval(fetchStatus, 5000)
    return () => clearInterval(timer)
  }, [fetchStatus])

  const handleAdd = async () => {
    const ep = addEndpoint.trim()
    if (!ep) {
      messageApi.warning('请输入 WebSocket 地址')
      return
    }
    if (!ep.startsWith('ws://') && !ep.startsWith('wss://')) {
      messageApi.warning('地址需以 ws:// 或 wss:// 开头')
      return
    }
    try {
      setAdding(true)
      const result = await xiaozhiAdd(ep)
      if (result.success) {
        messageApi.success(`已添加连接，正在连接...`)
        setAddEndpoint('')
        setAddModalOpen(false)
        setTimeout(fetchStatus, 2000)
      } else {
        messageApi.error(result.error || '添加失败')
      }
    } catch (e: unknown) {
      messageApi.error(e instanceof Error ? e.message : '添加失败')
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (index: number) => {
    try {
      setRemovingIdx(index)
      const result = await xiaozhiRemove(index)
      if (result.success) {
        messageApi.success('已删除连接')
        fetchStatus()
      } else {
        messageApi.error(result.error || '删除失败')
      }
    } catch (e: unknown) {
      messageApi.error(e instanceof Error ? e.message : '删除失败')
    } finally {
      setRemovingIdx(null)
    }
  }

  const clients: XiaozhiClientInfo[] = status?.clients ?? []
  const maxCount = status?.max_count ?? 10
  const canAdd = clients.length < maxCount

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

      {/* Connection List */}
      <Card
        title={
          <Space>
            <ApiOutlined />
            <span>连接列表</span>
            <Tag>{clients.length} / {maxCount}</Tag>
          </Space>
        }
        extra={
          <Space>
            <Button
              icon={<SyncOutlined spin={loading} />}
              onClick={fetchStatus}
              loading={loading}
            >
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setAddModalOpen(true)}
              disabled={!canAdd}
            >
              添加连接
            </Button>
          </Space>
        }
      >
        {loading && clients.length === 0 ? (
          <Spin tip="加载中..." />
        ) : clients.length === 0 ? (
          <Empty
            description="暂无小智平台连接"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setAddModalOpen(true)}
            >
              添加第一个连接
            </Button>
          </Empty>
        ) : (
          <List
            dataSource={clients}
            renderItem={(info) => (
              <ClientCard
                key={info.index}
                info={info}
                onRemove={handleRemove}
                removing={removingIdx === info.index}
              />
            )}
          />
        )}
      </Card>

      <Divider />

      {/* How it works */}
      <Card title="工作原理" size="small">
        <Paragraph>
          小智平台通过 WebSocket 连接，将本地所有 MCP 工具桥接到小智 AI 平台，使 AI 助手能够控制米家设备、摄像头和音箱。
          支持同时绑定最多 <Text strong>{maxCount}</Text> 个小智平台连接，每个连接独立运行。
        </Paragraph>
        <Space direction="vertical" size={4}>
          <Text type="secondary">• 协议：MCP (JSON-RPC 2.0) over WebSocket</Text>
          <Text type="secondary">• 角色：本服务作为 MCP Server，小智平台作为 MCP Client</Text>
          <Text type="secondary">• 自动重连：连接断开后自动重连</Text>
          <Text type="secondary">• 工具桥接：所有已注册的 MCP 工具自动暴露给每个小智平台连接</Text>
        </Space>
      </Card>

      {/* Add Connection Modal */}
      <Modal
        title={
          <Space>
            <PlusOutlined />
            添加小智平台连接
          </Space>
        }
        open={addModalOpen}
        onCancel={() => { setAddModalOpen(false); setAddEndpoint('') }}
        onOk={handleAdd}
        okText="保存并连接"
        cancelText="取消"
        confirmLoading={adding}
        okButtonProps={{ disabled: !addEndpoint.trim() }}
        destroyOnClose
      >
        <Form layout="vertical">
          <Form.Item
            label="WebSocket 端点"
            help={
              <span>
                从小智平台获取 WebSocket 地址（ws:// 或 wss://）<br />
                格式示例：<Text code>wss://api.xiaozhi.me/mcp/?token=...</Text>
              </span>
            }
          >
            <Input
              placeholder="wss://api.xiaozhi.me/mcp/?token=..."
              value={addEndpoint}
              onChange={(e) => setAddEndpoint(e.target.value)}
              onPressEnter={handleAdd}
              allowClear
              autoFocus
            />
          </Form.Item>
          {clients.length > 0 && (
            <Alert
              type="info"
              showIcon
              message={`当前已有 ${clients.length} 个连接，最多可添加 ${maxCount - clients.length} 个`}
              style={{ marginTop: 8 }}
            />
          )}
        </Form>
      </Modal>
    </div>
  )
}
