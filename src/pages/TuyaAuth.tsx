import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Card, Button, Tag, Spin, Empty,
  Table, message, Popconfirm, QRCode, Alert, Input,
  Space, Row, Col,
} from 'antd'
import {
  CloudOutlined, QrcodeOutlined, ReloadOutlined,
  LogoutOutlined, CheckCircleFilled, CloseCircleFilled,
  UserOutlined, GlobalOutlined, ClockCircleOutlined,
} from '@ant-design/icons'
import {
  getPlatforms, PlatformInfo,
  getTuyaQrCode, checkTuyaQrStatus, tuyaLogout,
  getTuyaDevices, refreshTuyaDevices, TuyaDevice,
} from '../services/mcp-client'
import { useAuthStore } from '../stores/authStore'
import { Hero, PageHeader, SoftTag, StatTile } from '../components/ui'

export default function TuyaAuth() {
  const serverOnline = useAuthStore((s) => s.serverOnline)
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([])
  const [loading, setLoading] = useState(false)

  const [userCode, setUserCode] = useState('')
  const [qrUrl, setQrUrl] = useState('')
  const [qrToken, setQrToken] = useState('')
  const [qrLoading, setQrLoading] = useState(false)
  const [qrPolling, setQrPolling] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [devices, setDevices] = useState<TuyaDevice[]>([])
  const [devLoading, setDevLoading] = useState(false)

  const [messageApi, contextHolder] = message.useMessage()

  const tuyaPlatform = platforms.find((p) => p.platform_id === 'tuya')
  const isAuthed = tuyaPlatform?.authenticated ?? false

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
      const data = await getTuyaDevices()
      setDevices(data.devices || [])
    } catch { /* ignore */ }
    finally { setDevLoading(false) }
  }, [])

  useEffect(() => {
    if (serverOnline) {
      fetchPlatforms()
    }
  }, [serverOnline, fetchPlatforms])

  useEffect(() => {
    if (isAuthed) fetchDevices()
  }, [isAuthed, fetchDevices])

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const handleGetQr = async () => {
    if (!userCode.trim()) {
      messageApi.warning('请先输入涂鸦 App 用户代码')
      return
    }
    try {
      setQrLoading(true)
      const data = await getTuyaQrCode(userCode.trim())
      if (data.success && data.qr_url) {
        setQrUrl(data.qr_url)
        setQrToken(data.token || '')
        setQrPolling(true)
        startPolling(data.token || '')
      } else {
        messageApi.error(data.error || '获取二维码失败')
      }
    } catch (e: unknown) {
      messageApi.error(e instanceof Error ? e.message : '请求失败')
    } finally {
      setQrLoading(false)
    }
  }

  const startPolling = (token: string) => {
    if (pollRef.current) clearInterval(pollRef.current)
    const code = userCode.trim()
    let attempts = 0
    pollRef.current = setInterval(async () => {
      attempts++
      if (attempts > 60) {
        clearInterval(pollRef.current!)
        pollRef.current = null
        setQrPolling(false)
        messageApi.warning('二维码已过期，请重新获取')
        return
      }
      try {
        const st = await checkTuyaQrStatus(token, code)
        if (st.status === 'authorized') {
          clearInterval(pollRef.current!)
          pollRef.current = null
          setQrPolling(false)
          setQrUrl('')
          setQrToken('')
          messageApi.success('涂鸦授权成功！')
          fetchPlatforms()
          fetchDevices()
        }
      } catch { /* continue polling */ }
    }, 3000)
  }

  const handleLogout = async () => {
    await tuyaLogout()
    messageApi.success('已退出涂鸦平台')
    setDevices([])
    fetchPlatforms()
  }

  const handleRefresh = async () => {
    try {
      setDevLoading(true)
      const r = await refreshTuyaDevices()
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
    { title: '类型', dataIndex: 'category', key: 'category',
      render: (v: string) => <Tag>{v || '-'}</Tag> },
    { title: '状态', dataIndex: 'online', key: 'online',
      render: (v: boolean) => v
        ? <SoftTag tone="success" dot>在线</SoftTag>
        : <SoftTag tone="default" dot>离线</SoftTag>,
      width: 100 },
    { title: '房间', dataIndex: 'room_name', key: 'room_name' },
    { title: '家庭', dataIndex: 'home_name', key: 'home_name' },
  ]

  if (!serverOnline) {
    return (
      <div className="fg-page">
        <PageHeader icon={<CloudOutlined />} title="涂鸦智能" subtitle="Tuya 智能家居生态账号授权" />
        <Hero tone="danger" icon={<CloseCircleFilled />} title="MCP Server 离线" />
      </div>
    )
  }

  const authStatus = tuyaPlatform?.auth_status as Record<string, unknown> | undefined

  return (
    <div className="fg-page" style={{ maxWidth: 980, margin: '0 auto' }}>
      {contextHolder}
      <PageHeader
        icon={<CloudOutlined />}
        title="涂鸦智能"
        subtitle="通过涂鸦 App 扫码完成账号授权，便可控制所有涂鸦生态设备"
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => fetchPlatforms()} loading={loading}>
            刷新
          </Button>
        }
      />

      <div style={{ marginBottom: 20 }}>
        <Hero
          tone={isAuthed ? 'success' : 'default'}
          icon={isAuthed ? <CheckCircleFilled /> : <CloudOutlined />}
          title={isAuthed ? '已连接涂鸦账号' : '未授权涂鸦账号'}
          description={
            isAuthed
              ? `区域端点 ${(authStatus?.endpoint as string) || 'apigw.tuyacn.com'} · ${devices.length} 台设备`
              : '在涂鸦 App 中获取用户代码，输入后扫码完成授权'
          }
          actions={
            isAuthed ? (
              <Popconfirm title="确定退出涂鸦平台?" onConfirm={handleLogout}>
                <Button danger icon={<LogoutOutlined />}>退出授权</Button>
              </Popconfirm>
            ) : null
          }
        />
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} md={6}>
          <StatTile icon={<CloudOutlined />} tone="info" label="平台" value="涂鸦智能" trend="Tuya / Smart Life" />
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
            label="区域端点"
            value={(authStatus?.endpoint as string) || 'apigw.tuyacn.com'}
          />
        </Col>
        <Col xs={12} md={6}>
          <StatTile
            icon={<ClockCircleOutlined />}
            label="设备数量"
            value={devices.length}
            suffix="台"
          />
        </Col>
      </Row>

      {!isAuthed && (
        <Card className="fg-card-antd" title="扫码授权" style={{ marginBottom: 20 }}>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <p style={{ color: 'var(--fg-text-secondary)', marginBottom: 0 }}>
              1. 打开涂鸦智能 / Smart Life App → 我的 → 设置 → 账号与安全，找到「用户代码」<br />
              2. 在下方输入用户代码并点击「获取二维码」<br />
              3. 使用涂鸦智能 App 扫描二维码完成授权
            </p>
            <Space wrap>
              <Input
                prefix={<UserOutlined />}
                placeholder="涂鸦 App 用户代码"
                value={userCode}
                onChange={(e) => setUserCode(e.target.value)}
                style={{ width: 240 }}
                allowClear
                size="large"
              />
              <Button
                type="primary"
                size="large"
                icon={<QrcodeOutlined />}
                onClick={handleGetQr}
                loading={qrLoading}
                disabled={!userCode.trim()}
              >
                获取二维码
              </Button>
            </Space>
          </Space>
        </Card>
      )}

      {qrUrl && (
        <Card className="fg-card-antd" title="扫码授权" style={{ marginBottom: 20, textAlign: 'center' }}>
          <Space direction="vertical" align="center" size="middle">
            <QRCode value={qrUrl} size={200} />
            <div style={{ color: 'var(--fg-text-secondary)' }}>
              请使用涂鸦智能 App 扫描上方二维码
            </div>
            {qrPolling && <Spin tip="等待扫码..." />}
          </Space>
        </Card>
      )}

      {isAuthed && (
        <Card
          className="fg-card-antd"
          title={
            <Space>
              <CloudOutlined /> 涂鸦设备
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
          {devices.length === 0 && !devLoading ? (
            <Empty description="暂无设备，请先在涂鸦 App 中添加设备" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <Table
              dataSource={devices}
              columns={deviceColumns}
              rowKey="id"
              loading={devLoading}
              size="middle"
              pagination={{ pageSize: 20, showSizeChanger: false }}
            />
          )}
        </Card>
      )}
    </div>
  )
}
