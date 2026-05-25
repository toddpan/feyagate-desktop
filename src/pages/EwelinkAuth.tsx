import { useEffect, useState, useCallback } from 'react'
import {
  Card, Typography, Space, Button, Tag, Empty,
  Table, Descriptions, message, Popconfirm, Input, Form, Select,
} from 'antd'
import {
  NodeIndexOutlined, ReloadOutlined, LogoutOutlined,
  CheckCircleOutlined, CloseCircleOutlined, UserOutlined, LockOutlined,
} from '@ant-design/icons'
import {
  getPlatforms, PlatformInfo,
  ewelinkLogin, ewelinkLogout,
  getEwelinkDevices, refreshEwelinkDevices, EwelinkDevice,
} from '../services/mcp-client'
import { useAuthStore } from '../stores/authStore'

const { Title, Text } = Typography

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
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '设备ID', dataIndex: 'id', key: 'id', ellipsis: true },
    { title: '类型', dataIndex: 'type', key: 'type',
      render: (v: string) => <Tag>{v || '-'}</Tag> },
    { title: '状态', dataIndex: 'online', key: 'online',
      render: (v: boolean) => v
        ? <Tag color="green" icon={<CheckCircleOutlined />}>在线</Tag>
        : <Tag color="default" icon={<CloseCircleOutlined />}>离线</Tag>
    },
    { title: '品牌', dataIndex: 'brand', key: 'brand',
      render: (v: string) => v || '-' },
    { title: '型号', dataIndex: 'model', key: 'model',
      render: (v: string) => v || '-' },
  ]

  if (!serverOnline) return <Empty description="MCP Server 离线" />

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {contextHolder}
      <Space align="center" style={{ marginBottom: 16 }}>
        <NodeIndexOutlined style={{ fontSize: 24 }} />
        <Title level={3} style={{ margin: 0 }}>易微联</Title>
      </Space>

      <Card title="平台状态" loading={loading} style={{ marginBottom: 16 }}>
        <Descriptions column={2} size="small">
          <Descriptions.Item label="平台">易微联 eWeLink</Descriptions.Item>
          <Descriptions.Item label="认证状态">
            {isAuthed
              ? <Tag color="green">已授权</Tag>
              : <Tag color="red">未授权</Tag>
            }
          </Descriptions.Item>
          {ewelinkPlatform?.auth_status && (
            <>
              <Descriptions.Item label="区域">
                {(ewelinkPlatform.auth_status as Record<string, string>).region || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Token 剩余">
                {(ewelinkPlatform.auth_status as Record<string, number>).token_remaining_seconds
                  ? `${Math.floor(Number((ewelinkPlatform.auth_status as Record<string, number>).token_remaining_seconds) / 86400)} 天`
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
              <Popconfirm title="确定退出易微联平台？" onConfirm={handleLogout}>
                <Button danger icon={<LogoutOutlined />}>退出授权</Button>
              </Popconfirm>
            </>
          )}
        </Space>
      </Card>

      {!isAuthed && (
        <Card title="账号登录" style={{ marginBottom: 16 }}>
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
              background: '#f0f5ff',
              borderRadius: 4,
              fontSize: 12,
              color: '#1890ff'
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
              <Button type="primary" htmlType="submit" loading={loginLoading} block>
                登录
              </Button>
            </Form.Item>
          </Form>
          <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
            使用易微联 eWeLink App 注册的账号密码登录。系统支持 200+ 个国家/地区的自动区域映射和智能重定向。
          </Text>
        </Card>
      )}

      {isAuthed && (
        <Card
          title={`易微联设备 (${devices.length})`}
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
