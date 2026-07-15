import { useEffect, useState, useCallback } from 'react'
import {
  Card, Button, Tag, Empty,
  Table, message, Popconfirm, Input, Form, Radio,
  Space, Row, Col,
} from 'antd'
import {
  HomeOutlined, ReloadOutlined, LogoutOutlined,
  CheckCircleFilled, CloseCircleFilled, UserOutlined, LockOutlined,
  CloudOutlined, ClockCircleOutlined,
} from '@ant-design/icons'
import {
  getPlatforms, PlatformInfo,
  mideaLogin, mideaLogout,
  getMideaDevices, refreshMideaDevices, MideaDevice,
} from '../services/mcp-client'
import { useAuthStore } from '../stores/authStore'
import { Hero, PageHeader, SoftTag, StatTile } from '../components/ui'

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
    { title: '名称', dataIndex: 'name', key: 'name',
      render: (v: string) => <span style={{ fontWeight: 500 }}>{v || '-'}</span> },
    { title: '设备 ID', dataIndex: 'id', key: 'id', ellipsis: true },
    { title: '类型', dataIndex: 'type', key: 'type',
      render: (v: string) => <Tag>{v || '-'}</Tag> },
    { title: '状态', dataIndex: 'online', key: 'online',
      render: (v: boolean) => v
        ? <SoftTag tone="success" dot>在线</SoftTag>
        : <SoftTag tone="default" dot>离线</SoftTag>,
      width: 100 },
    { title: '型号', dataIndex: 'model_number', key: 'model_number',
      render: (v: string) => v || '-' },
  ]

  if (!serverOnline) {
    return (
      <div className="fg-page">
        <PageHeader icon={<HomeOutlined />} title="美的美居" subtitle="美的智能家居生态账号授权" />
        <Hero tone="danger" icon={<CloseCircleFilled />} title="MCP Server 离线" />
      </div>
    )
  }

  const authStatus = mideaPlatform?.auth_status as Record<string, unknown> | undefined

  return (
    <div className="fg-page" style={{ maxWidth: 980, margin: '0 auto' }}>
      {contextHolder}
      <PageHeader
        icon={<HomeOutlined />}
        title="美的美居"
        subtitle="登录美的账号，便可控制美的美居生态中的所有家电设备"
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => fetchPlatforms()} loading={loading}>
            刷新
          </Button>
        }
      />

      <div style={{ marginBottom: 20 }}>
        <Hero
          tone={isAuthed ? 'success' : 'default'}
          icon={isAuthed ? <CheckCircleFilled /> : <HomeOutlined />}
          title={isAuthed ? '已连接美的账号' : '未授权美的账号'}
          description={
            isAuthed
              ? `账号 ${(authStatus?.account_masked as string) || '-'} · ${devices.length} 台设备`
              : '在下方输入账号密码即可登录'
          }
          actions={
            isAuthed ? (
              <Popconfirm title="确定退出美的平台?" onConfirm={handleLogout}>
                <Button danger icon={<LogoutOutlined />}>退出授权</Button>
              </Popconfirm>
            ) : null
          }
        />
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} md={6}>
          <StatTile icon={<HomeOutlined />} tone="info" label="平台" value="美的美居" trend="Midea / MSmart" />
        </Col>
        <Col xs={12} md={6}>
          <StatTile
            icon={isAuthed ? <CheckCircleFilled /> : <CloseCircleFilled />}
            tone={isAuthed ? 'success' : 'default'}
            label="授权状态"
            value={isAuthed ? '已授权' : '未授权'}
          />
        </Col>
        <Col xs={12} md={6}>
          <StatTile
            icon={<CloudOutlined />}
            label="已登录账号"
            value={(authStatus?.account_masked as string) || '—'}
          />
        </Col>
        <Col xs={12} md={6}>
          <StatTile icon={<ClockCircleOutlined />} label="设备数量" value={devices.length} suffix="台" />
        </Col>
      </Row>

      {!isAuthed && (
        <Card className="fg-card-antd" title="账号登录" style={{ marginBottom: 20 }}>
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
            <Space wrap>
              <Form.Item name="account" rules={[{ required: true, message: '请输入手机号/邮箱' }]}>
                <Input prefix={<UserOutlined />} placeholder="手机号 / 邮箱" style={{ width: 240 }} />
              </Form.Item>
              <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
                <Input.Password prefix={<LockOutlined />} placeholder="密码" style={{ width: 220 }} />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loginLoading} size="large">
                  登录
                </Button>
              </Form.Item>
            </Space>
            <div style={{ color: 'var(--fg-text-tertiary)', marginTop: 12, fontSize: 12 }}>
              美的美居：中国区域用户 | MSmartHome：国际区域用户（自动路由到所在区域）
            </div>
          </Form>
        </Card>
      )}

      {isAuthed && (
        <Card
          className="fg-card-antd"
          title={
            <Space>
              <HomeOutlined /> 美的设备
              <Tag>{devices.length}</Tag>
            </Space>
          }
          bodyStyle={{ padding: 0 }}
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
            size="middle"
            pagination={{ pageSize: 20, showSizeChanger: false }}
            locale={{ emptyText: <Empty description="暂无设备" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
          />
        </Card>
      )}
    </div>
  )
}
