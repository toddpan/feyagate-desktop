import { useEffect, useState, useCallback } from 'react'
import {
  Card, Button, Tag, Empty,
  Table, message, Popconfirm, Input, Form, Select,
  Space, Row, Col,
} from 'antd'
import {
  NodeIndexOutlined, ReloadOutlined, LogoutOutlined,
  CheckCircleFilled, CloseCircleFilled, UserOutlined, LockOutlined,
  GlobalOutlined, ClockCircleOutlined,
} from '@ant-design/icons'
import {
  getPlatforms, PlatformInfo,
  ewelinkLogin, ewelinkLogout,
  getEwelinkDevices, refreshEwelinkDevices, EwelinkDevice,
} from '../services/mcp-client'
import { useAuthStore } from '../stores/authStore'
import { Hero, PageHeader, SoftTag, StatTile } from '../components/ui'

// 扩展的国家码列表（常用国家）
const COUNTRY_CODES = [
  { value: '+86', label: '中国 (+86) → cn', region: 'cn' },
  { value: '+1', label: '美国 (+1) → us', region: 'us' },
  { value: '+44', label: '英国 (+44) → eu', region: 'eu' },
  { value: '+49', label: '德国 (+49) → eu', region: 'eu' },
  { value: '+33', label: '法国 (+33) → eu', region: 'eu' },
  { value: '+81', label: '日本 (+81) → as', region: 'as' },
  { value: '+82', label: '韩国 (+82) → as', region: 'as' },
  { value: '+61', label: '澳大利亚 (+61) → us', region: 'us' },
  { value: '+91', label: '印度 (+91) → as', region: 'as' },
  { value: '+7', label: '俄罗斯 (+7) → eu', region: 'eu' },
  { value: '+55', label: '巴西 (+55) → us', region: 'us' },
  { value: '+65', label: '新加坡 (+65) → as', region: 'as' },
  { value: '+60', label: '马来西亚 (+60) → as', region: 'as' },
  { value: '+66', label: '泰国 (+66) → as', region: 'as' },
  { value: '+84', label: '越南 (+84) → as', region: 'as' },
  { value: '+62', label: '印度尼西亚 (+62) → as', region: 'as' },
  { value: '+63', label: '菲律宾 (+63) → as', region: 'as' },
  { value: '+852', label: '香港 (+852) → as', region: 'as' },
  { value: '+886', label: '台湾 (+886) → as', region: 'as' },
  { value: '+853', label: '澳门 (+853) → as', region: 'as' },
]

const REGION_NAMES: Record<string, string> = {
  cn: '中国大陆',
  us: '美洲',
  eu: '欧洲',
  as: '亚洲',
}

export default function EwelinkAuth() {
  const serverOnline = useAuthStore((s) => s.serverOnline)
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [loginLoading, setLoginLoading] = useState(false)
  const [selectedRegion, setSelectedRegion] = useState('cn')

  const [devices, setDevices] = useState<EwelinkDevice[]>([])
  const [devLoading, setDevLoading] = useState(false)

  const [messageApi, contextHolder] = message.useMessage()
  const [form] = Form.useForm()

  const ewelinkPlatform = platforms.find((p) => p.platform_id === 'ewelink')
  const isAuthed = ewelinkPlatform?.authenticated ?? false

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
      const data = await getEwelinkDevices()
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

  const handleLogin = async (values: { email: string; password: string; country_code: string }) => {
    try {
      setLoginLoading(true)
      const result = await ewelinkLogin(values.email, values.password, values.country_code)
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
    await ewelinkLogout()
    messageApi.success('已退出易微联平台')
    setDevices([])
    fetchPlatforms()
  }

  const handleRefresh = async () => {
    try {
      setDevLoading(true)
      const r = await refreshEwelinkDevices()
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
    { title: '品牌', dataIndex: 'brand', key: 'brand',
      render: (v: string) => v || '-' },
    { title: '型号', dataIndex: 'model', key: 'model',
      render: (v: string) => v || '-' },
  ]

  if (!serverOnline) {
    return (
      <div className="fg-page">
        <PageHeader icon={<NodeIndexOutlined />} title="易微联" subtitle="eWeLink 智能家居生态账号授权" />
        <Hero tone="danger" icon={<CloseCircleFilled />} title="MCP Server 离线" />
      </div>
    )
  }

  const authStatus = ewelinkPlatform?.auth_status as Record<string, unknown> | undefined
  const region = (authStatus?.region as string) || selectedRegion

  return (
    <div className="fg-page" style={{ maxWidth: 980, margin: '0 auto' }}>
      {contextHolder}
      <PageHeader
        icon={<NodeIndexOutlined />}
        title="易微联"
        subtitle="登录 eWeLink 账号，便可控制易微联生态中的所有设备"
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => fetchPlatforms()} loading={loading}>
            刷新
          </Button>
        }
      />

      <div style={{ marginBottom: 20 }}>
        <Hero
          tone={isAuthed ? 'success' : 'default'}
          icon={isAuthed ? <CheckCircleFilled /> : <NodeIndexOutlined />}
          title={isAuthed ? '已连接易微联账号' : '未授权易微联账号'}
          description={
            isAuthed
              ? `区域 ${region.toUpperCase()} · ${devices.length} 台设备`
              : '支持 200+ 个国家/地区，自动区域映射与智能重定向'
          }
          actions={
            isAuthed ? (
              <Popconfirm title="确定退出易微联平台?" onConfirm={handleLogout}>
                <Button danger icon={<LogoutOutlined />}>退出授权</Button>
              </Popconfirm>
            ) : null
          }
        />
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} md={6}>
          <StatTile icon={<NodeIndexOutlined />} tone="info" label="平台" value="易微联" trend="eWeLink / CoolKit" />
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
            icon={<GlobalOutlined />}
            label="当前区域"
            value={region.toUpperCase()}
            trend={REGION_NAMES[region] || region}
          />
        </Col>
        <Col xs={12} md={6}>
          <StatTile icon={<ClockCircleOutlined />} label="设备数量" value={devices.length} suffix="台" />
        </Col>
      </Row>

      {!isAuthed && (
        <Card className="fg-card-antd" title="账号登录" style={{ marginBottom: 20 }}>
          <Form
            form={form}
            onFinish={handleLogin}
            layout="vertical"
            initialValues={{ country_code: '+86' }}
          >
            <Form.Item
              name="country_code"
              label="国家/地区"
              tooltip="选择您的手机号或账号注册时使用的国家/地区"
            >
              <Select
                options={COUNTRY_CODES}
                style={{ width: '100%' }}
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                onChange={(value) => {
                  const country = COUNTRY_CODES.find(c => c.value === value)
                  if (country) setSelectedRegion(country.region)
                }}
              />
            </Form.Item>

            <div style={{
              marginBottom: 16,
              padding: '8px 12px',
              background: 'var(--fg-brand-soft)',
              borderRadius: 6,
              fontSize: 12,
              color: 'var(--fg-brand)',
            }}>
              <strong>映射区域:</strong> {selectedRegion} ({REGION_NAMES[selectedRegion]})
            </div>

            <Form.Item
              name="email"
              label="邮箱 / 手机号"
              rules={[{ required: true, message: '请输入邮箱/手机号' }]}
            >
              <Input prefix={<UserOutlined />} placeholder="邮箱 / 手机号" />
            </Form.Item>

            <Form.Item
              name="password"
              label="密码"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="密码" />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loginLoading} block size="large">
                登录
              </Button>
            </Form.Item>
            <div style={{ color: 'var(--fg-text-tertiary)', fontSize: 12, marginTop: 8 }}>
              使用易微联 eWeLink App 注册的账号密码登录。系统支持 200+ 个国家/地区的自动区域映射和智能重定向。
            </div>
          </Form>
        </Card>
      )}

      {isAuthed && (
        <Card
          className="fg-card-antd"
          title={
            <Space>
              <NodeIndexOutlined /> 易微联设备
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
