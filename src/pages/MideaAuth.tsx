import { useEffect, useState, useCallback } from 'react'
import {
  Card, Typography, Space, Button, Tag, Empty,
  Table, Descriptions, message, Popconfirm, Input, Form, Radio,
} from 'antd'
import {
  HomeOutlined, ReloadOutlined, LogoutOutlined,
  CheckCircleOutlined, CloseCircleOutlined, UserOutlined, LockOutlined,
} from '@ant-design/icons'
import {
  getPlatforms, PlatformInfo,
  mideaLogin, mideaLogout,
  getMideaDevices, refreshMideaDevices, MideaDevice,
} from '../services/mcp-client'
import { useAuthStore } from '../stores/authStore'

const { Title, Text } = Typography

export default function MideaAuth() {
  const serverOnline = useAuthStore((s) => s.serverOnline)
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [loginLoading, setLoginLoading] = useState(false)

  const [devices, setDevices] = useState<MideaDevice[]>([])
  const [devLoading, setDevLoading] = useState(false)

  const [messageApi, contextHolder] = message.useMessage()
  const [form] = Form.useForm()

  const mideaPlatform = platforms.find((p) => p.platform_id === 'midea')
  const isAuthed = mideaPlatform?.authenticated ?? false

  const fetchPlatforms = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getPlatforms()
      setPlatforms(Array.isArray(data) ? data : [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  const fetchDevices = useCallback(async () => {
    try {
      setDevLoading(true)
      const data = await getMideaDevices()
      setDevices(data.devices || [])
    } catch { /* ignore */ }
    finally { setDevLoading(false) }
  }, [])

  useEffect(() => {
    if (serverOnline) fetchPlatforms()
  }, [serverOnline, fetchPlatforms])

  useEffect(() => {
    if (isAuthed) fetchDevices()
  }, [isAuthed, fetchDevices])

  const handleLogin = async (values: { account: string; password: string; cloud: 'meiju' | 'msmart' }) => {
    try {
      setLoginLoading(true)
      const result = await mideaLogin(values.account, values.password, values.cloud)
      if (result.success) {
        messageApi.success(`登录成功，共 ${result.device_count ?? 0} 台设备`)
        form.resetFields()
        fetchPlatforms()
      } else {
        messageApi.error(result.message || '登录失败')
      }
    } catch (e: unknown) {
      messageApi.error(e instanceof Error ? e.message : '请求失败')
    } finally {
      setLoginLoading(false)
    }
  }

  const handleLogout = async () => {
    await mideaLogout()
    messageApi.success('已退出美的平台')
    setDevices([])
    fetchPlatforms()
  }

  const handleRefresh = async () => {
    try {
      setDevLoading(true)
      const r = await refreshMideaDevices()
      if (r.success) {
        messageApi.success(`刷新成功，共 ${r.device_count} 台设备`)
        fetchDevices()
      }
    } catch (e: unknown) {
      messageApi.error(e instanceof Error ? e.message : '刷新失败')
    } finally {
      setDevLoading(false)
    }
  }

  const deviceColumns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '设备ID', dataIndex: 'id', key: 'id', ellipsis: true },
    { title: '类型', dataIndex: 'type', key: 'type',
      render: (v: string) => <Tag>{v || '-'}</Tag> },
    { title: '状态', dataIndex: 'online', key: 'online',
      render: (v: boolean) => v
        ? <Tag color="green" icon={<CheckCircleOutlined />}>在线</Tag>
        : <Tag color="default" icon={<CloseCircleOutlined />}>离线</Tag>
    },
    { title: '型号', dataIndex: 'model_number', key: 'model_number',
      render: (v: string) => v || '-' },
  ]

  if (!serverOnline) return <Empty description="MCP Server 离线" />

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {contextHolder}
      <Space align="center" style={{ marginBottom: 16 }}>
        <HomeOutlined style={{ fontSize: 24 }} />
        <Title level={3} style={{ margin: 0 }}>美的美居</Title>
      </Space>

      <Card title="平台状态" loading={loading} style={{ marginBottom: 16 }}>
        <Descriptions column={2} size="small">
          <Descriptions.Item label="平台">美的美居</Descriptions.Item>
          <Descriptions.Item label="认证状态">
            {isAuthed
              ? <Tag color="green">已授权</Tag>
              : <Tag color="red">未授权</Tag>
            }
          </Descriptions.Item>
          {mideaPlatform?.auth_status && (
            <>
              <Descriptions.Item label="账号">
                {(mideaPlatform.auth_status as Record<string, string>).account_masked || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Token 剩余">
                {(mideaPlatform.auth_status as Record<string, number>).token_remaining_seconds
                  ? `${Math.floor(Number((mideaPlatform.auth_status as Record<string, number>).token_remaining_seconds) / 3600)} 小时`
                  : '-'
                }
              </Descriptions.Item>
            </>
          )}
        </Descriptions>

        <Space style={{ marginTop: 12 }} wrap>
          {isAuthed && (
            <>
              <Button icon={<ReloadOutlined />} onClick={() => fetchPlatforms()}>
                刷新状态
              </Button>
              <Popconfirm title="确定退出美的平台？" onConfirm={handleLogout}>
                <Button danger icon={<LogoutOutlined />}>退出授权</Button>
              </Popconfirm>
            </>
          )}
        </Space>
      </Card>

      {!isAuthed && (
        <Card title="账号登录" style={{ marginBottom: 16 }}>
          <Form form={form} onFinish={handleLogin} layout="vertical" initialValues={{ cloud: 'meiju' }}>
            <Form.Item
              name="cloud"
              label="云服务"
              rules={[{ required: true, message: '请选择云服务' }]}
            >
              <Radio.Group>
                <Radio value="meiju">美的美居（中国）</Radio>
                <Radio value="msmart">MSmartHome（国际）</Radio>
              </Radio.Group>
            </Form.Item>
            <Space>
              <Form.Item name="account" rules={[{ required: true, message: '请输入手机号/邮箱' }]}>
                <Input prefix={<UserOutlined />} placeholder="手机号 / 邮箱" style={{ width: 200 }} />
              </Form.Item>
              <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
                <Input.Password prefix={<LockOutlined />} placeholder="密码" style={{ width: 180 }} />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loginLoading}>
                  登录
                </Button>
              </Form.Item>
            </Space>
          </Form>
          <Text type="secondary" style={{ display: 'block', marginTop: 12, fontSize: 12 }}>
            美的美居：中国区域用户 | MSmartHome：国际区域用户（自动路由到所在区域）
          </Text>
        </Card>
      )}

      {isAuthed && (
        <Card
          title={`美的设备 (${devices.length})`}
          extra={
            <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={devLoading}>
              刷新设备
            </Button>
          }
        >
          <Table
            dataSource={devices}
            columns={deviceColumns}
            rowKey="id"
            loading={devLoading}
            size="small"
            pagination={{ pageSize: 20 }}
            locale={{ emptyText: '暂无设备' }}
          />
        </Card>
      )}
    </div>
  )
}
