import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Card, Button, Tag, Empty,
  Descriptions, message, Popconfirm, Input, Alert,
  Modal, Steps, Divider, Spin, Select, Space, Row, Col,
} from 'antd'
import {
  CloudOutlined, ReloadOutlined, LoginOutlined,
  CheckCircleFilled, CloseCircleFilled, SwapOutlined,
  RedoOutlined, ExclamationCircleOutlined, CopyOutlined,
  GlobalOutlined, ClockCircleOutlined,
} from '@ant-design/icons'
import {
  getPlatforms, PlatformInfo,
  getAuthStatus, getAuthUrl, authCallback, openOAuth, onAuthCode,
  getDeviceList, refreshDevices, Device, getServerUrl,
} from '../services/mcp-client'
import { useAuthStore } from '../stores/authStore'
import { Hero, PageHeader, SoftTag, StatTile } from '../components/ui'
import { Table } from 'antd'

const isElectron = !!window.feyagate

const REGION_OPTIONS = [
  { value: 'cn', label: '中国大陆 (cn)' },
  { value: 'de', label: '欧洲 (de)' },
  { value: 'i2', label: '印度 (i2)' },
  { value: 'ru', label: '俄罗斯 (ru)' },
  { value: 'sg', label: '新加坡 (sg)' },
  { value: 'us', label: '美国 (us)' },
]

function formatRemaining(seconds: number): string {
  if (seconds <= 0) return '已过期'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 24) return `${Math.floor(h / 24)} 天 ${h % 24} 小时`
  if (h > 0) return `${h} 小时 ${m} 分钟`
  return `${m} 分钟`
}

function extractCodeFromUrl(input: string): string | null {
  try {
    const trimmed = input.trim()
    if (trimmed.length < 10) return trimmed || null
    const url = new URL(trimmed)
    return url.searchParams.get('code')
  } catch {
    return input.trim() || null
  }
}

export default function XiaomiAuth() {
  const serverOnline = useAuthStore((s) => s.serverOnline)
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([])
  const [loading, setLoading] = useState(false)

  const [authStatus, setAuthStatus] = useState<
    { authorized: boolean; cloud_server: string; remaining_seconds: number } | null
  >(null)
  const [oauthPending, setOauthPending] = useState(false)
  const [manualUrlInput, setManualUrlInput] = useState('')
  const [submittingCode, setSubmittingCode] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const popupRef = useRef<Window | null>(null)

  const [devices, setDevices] = useState<Device[]>([])
  const [devLoading, setDevLoading] = useState(false)
  const [devRefreshing, setDevRefreshing] = useState(false)
  const [selectedRegion, setSelectedRegion] = useState('cn')
  const regionRef = useRef(selectedRegion)
  regionRef.current = selectedRegion

  const [messageApi, contextHolder] = message.useMessage()

  const xiaomiPlatform = platforms.find((p) => p.platform_id === 'xiaomi')
  const isAuthed = authStatus?.authorized ?? xiaomiPlatform?.authenticated ?? false

  const fetchPlatforms = useCallback(async () => {
    try {
      setLoading(true)
      const [plats, status] = await Promise.all([getPlatforms(), getAuthStatus()])
      setPlatforms(Array.isArray(plats) ? plats : [])
      setAuthStatus(status)
      if (status.cloud_server) setSelectedRegion(status.cloud_server)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  const fetchDevices = useCallback(async () => {
    try {
      setDevLoading(true)
      const data = await getDeviceList()
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

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  useEffect(() => {
    onAuthCode(async (code) => {
      try {
        await authCallback(code, regionRef.current)
        setOauthPending(false)
        messageApi.success('米家登录成功！')
        fetchPlatforms()
      } catch { /* ignore */ }
    })
    if (window.feyagate?.onAuthSuccess) {
      window.feyagate.onAuthSuccess(() => {
        setOauthPending(false)
        fetchPlatforms()
        messageApi.success('米家登录成功！')
      })
    }
  }, [fetchPlatforms, messageApi])

  const handleStartOAuth = async () => {
    if (isElectron) {
      useAuthStore.getState().startOAuth(selectedRegion)
    } else {
      try {
        const url = await getAuthUrl(selectedRegion)
        const serverUrl = await getServerUrl()
        const callbackBase = serverUrl || window.location.origin
        let popup: Window | null = null
        try {
          const testResp = await fetch(`${callbackBase}/auth/browser-start`, { method: 'HEAD', signal: AbortSignal.timeout(2000) })
          if (testResp.ok) {
            popup = window.open(
              `${callbackBase}/auth/browser-start?callback=${encodeURIComponent(callbackBase + '/auth/callback')}&oauth_url=${encodeURIComponent(url)}`,
              'xiaomi_oauth', 'width=520,height=700,popup=true,scrollbars=yes'
            )
          }
        } catch { /* fallback */ }
        if (!popup || popup.closed) {
          popup = window.open(url, 'xiaomi_oauth', 'width=520,height=700,popup=true,scrollbars=yes')
        }
        popupRef.current = popup
        setOauthPending(true)
        startBrowserPoll()
      } catch (e) {
        messageApi.error(`启动登录失败: ${e}`)
      }
    }
  }

  const startBrowserPoll = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const status = await getAuthStatus()
        if (status.authorized && status.remaining_seconds > 0) {
          clearInterval(pollRef.current!)
          pollRef.current = null
          setOauthPending(false)
          setAuthStatus(status)
          if (popupRef.current && !popupRef.current.closed) popupRef.current.close()
          fetchPlatforms()
          messageApi.success('米家登录成功！')
        }
      } catch { /* continue */ }
    }, 3000)
    setTimeout(() => { if (pollRef.current) clearInterval(pollRef.current) }, 300000)
  }, [fetchPlatforms, messageApi])

  const handleManualCodeSubmit = async () => {
    const code = extractCodeFromUrl(manualUrlInput)
    if (!code) { messageApi.error('无法识别授权码'); return }
    setSubmittingCode(true)
    try {
      await authCallback(code, selectedRegion)
      setOauthPending(false)
      setManualUrlInput('')
      if (popupRef.current && !popupRef.current.closed) popupRef.current.close()
      messageApi.success('登录成功！')
      fetchPlatforms()
    } catch (e) {
      messageApi.error(`登录失败: ${e}`)
    } finally { setSubmittingCode(false) }
  }

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        setManualUrlInput(text)
        const code = extractCodeFromUrl(text)
        if (code) {
          setSubmittingCode(true)
          try {
            await authCallback(code, selectedRegion)
            setOauthPending(false)
            setManualUrlInput('')
            if (popupRef.current && !popupRef.current.closed) popupRef.current.close()
            messageApi.success('登录成功！')
            fetchPlatforms()
          } catch (e) { messageApi.error(`登录失败: ${e}`) }
          finally { setSubmittingCode(false) }
        }
      }
    } catch { messageApi.info('请手动粘贴地址到输入框') }
  }

  const handleRefresh = async () => {
    try {
      setDevRefreshing(true)
      const r = await refreshDevices()
      messageApi.success(`刷新成功，共 ${r.device_count} 台设备，${r.camera_count} 个摄像头`)
      fetchDevices()
    } catch (e: unknown) {
      messageApi.error(e instanceof Error ? e.message : '刷新失败')
    } finally { setDevRefreshing(false) }
  }

  const deviceColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (v: string) => <span style={{ fontWeight: 500 }}>{v || '-'}</span>,
    },
    { title: '设备 ID', dataIndex: 'did', key: 'did', ellipsis: true },
    {
      title: '型号',
      dataIndex: 'model',
      key: 'model',
      render: (v: string) => <Tag>{v || '-'}</Tag>,
    },
    {
      title: '状态', dataIndex: 'online', key: 'online',
      render: (v: boolean) => v
        ? <SoftTag tone="success" dot>在线</SoftTag>
        : <SoftTag tone="default" dot>离线</SoftTag>,
      width: 100,
    },
    { title: '房间', dataIndex: 'room', key: 'room' },
    { title: '家庭', dataIndex: 'home', key: 'home' },
  ]

  if (!serverOnline) {
    return (
      <div className="fg-page">
        <PageHeader
          icon={<CloudOutlined />}
          title="米家"
          subtitle="小米 / 米家 智能家居生态账号登录"
        />
        <Hero
          tone="danger"
          icon={<CloseCircleFilled />}
          title="MCP Server 离线"
          description="请先启动本地 MCP Server，连接恢复后此处会自动刷新。"
        />
      </div>
    )
  }

  return (
    <div className="fg-page" style={{ maxWidth: 980, margin: '0 auto' }}>
      {contextHolder}
      <PageHeader
        icon={<CloudOutlined />}
        title="米家登录"
        subtitle="连接你的小米 / 米家账号，便可控制米家生态中的所有设备"
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => fetchPlatforms()} loading={loading}>
            刷新
          </Button>
        }
      />

      {/* Status Hero */}
      <div style={{ marginBottom: 20 }}>
        <Hero
          tone={isAuthed ? 'success' : 'default'}
          icon={isAuthed ? <CheckCircleFilled /> : <CloudOutlined />}
          title={
            isAuthed
              ? '已连接米家账号'
              : '未登录米家账号'
          }
          description={
            isAuthed
              ? `当前云服务器：${(authStatus?.cloud_server || '').toUpperCase() || '-'} · Token 剩余：${formatRemaining(authStatus?.remaining_seconds ?? 0)}`
              : '点击下方按钮在弹窗中登录你的米家账号'
          }
          actions={
            isAuthed ? (
              <Space>
                <Button icon={<RedoOutlined />} onClick={() => {
                  Modal.confirm({
                    title: '重新登录',
                    icon: <ExclamationCircleOutlined />,
                    content: '将重新打开小米登录页面，使用当前账号重新登录。',
                    okText: '重新登录', cancelText: '取消',
                    onOk: handleStartOAuth,
                  })
                }}>
                  重新登录
                </Button>
                <Popconfirm title="确定切换账号？当前登录信息将清除" onConfirm={async () => {
                  useAuthStore.setState({ authorized: false, cloudServer: '', remainingSeconds: 0 })
                  await handleStartOAuth()
                }}>
                  <Button danger icon={<SwapOutlined />}>切换账号</Button>
                </Popconfirm>
              </Space>
            ) : null
          }
        />
      </div>

      {/* Stat row */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} md={6}>
          <StatTile
            icon={<CloudOutlined />}
            label="平台"
            value="米家"
            trend="小米 / 米家"
            tone="info"
          />
        </Col>
        <Col xs={12} md={6}>
          <StatTile
            icon={isAuthed ? <CheckCircleFilled /> : <CloseCircleFilled />}
            tone={isAuthed ? 'success' : 'default'}
            label="登录状态"
            value={isAuthed ? '已登录' : '未登录'}
          />
        </Col>
        <Col xs={12} md={6}>
          <StatTile
            icon={<GlobalOutlined />}
            label="云服务器"
            value={(authStatus?.cloud_server || '-').toUpperCase()}
            trend={selectedRegion ? `当前选择：${selectedRegion.toUpperCase()}` : ''}
          />
        </Col>
        <Col xs={12} md={6}>
          <StatTile
            icon={<ClockCircleOutlined />}
            label="Token 剩余"
            value={authStatus?.remaining_seconds ? formatRemaining(authStatus.remaining_seconds) : '—'}
            tone={isAuthed ? 'success' : 'default'}
          />
        </Col>
      </Row>

      {/* Login card */}
      {!isAuthed && !oauthPending && (
        <Card className="fg-card-antd" title="账号登录" style={{ marginBottom: 20 }}>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <p style={{ color: 'var(--fg-text-secondary)', marginBottom: 0 }}>
              选择云服务器区域后，点击下方按钮在弹窗中登录米家账号。
              登录完成后，弹窗会自动关闭，本页面会自动更新状态。
            </p>
            <Space wrap>
              <Select
                value={selectedRegion}
                onChange={setSelectedRegion}
                options={REGION_OPTIONS}
                style={{ width: 200 }}
              />
              <Button
                type="primary"
                size="large"
                icon={<LoginOutlined />}
                onClick={handleStartOAuth}
              >
                使用米家账号登录
              </Button>
            </Space>
          </Space>
        </Card>
      )}

      {/* OAuth pending */}
      {oauthPending && (
        <Card className="fg-card-antd" title="扫码 / 登录流程" style={{ marginBottom: 20 }}>
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Alert
              type="info"
              showIcon
              message="小米登录页面已在弹窗中打开。如果弹窗被浏览器拦截，请允许后重试。"
            />
            <Steps
              direction="vertical"
              size="small"
              current={1}
              items={[
                { title: '在弹窗中登录小米账号', status: 'finish' },
                {
                  title: '复制错误页面的地址',
                  status: 'process',
                  description: '登录后弹窗会显示"无法访问此网站"— 请复制地址栏 URL',
                },
                { title: '完成登录', status: 'wait' },
              ]}
            />
            <Card
              size="small"
              style={{
                background: 'linear-gradient(135deg, #fff7e6 0%, #fff1f0 100%)',
                border: '2px solid #fa8c16',
              }}
            >
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <Button
                  type="primary"
                  size="large"
                  icon={<CopyOutlined />}
                  onClick={handlePasteFromClipboard}
                  loading={submittingCode}
                  block
                  style={{ height: 48, fontSize: 16 }}
                >
                  一键粘贴地址并完成登录
                </Button>
                <Divider plain style={{ margin: '4px 0', fontSize: 12 }}>或手动输入</Divider>
                <Input.TextArea
                  placeholder="粘贴 URL 或输入授权码"
                  value={manualUrlInput}
                  onChange={(e) => setManualUrlInput(e.target.value)}
                  autoSize={{ minRows: 2, maxRows: 4 }}
                  allowClear
                />
                <Space>
                  <Button
                    type="primary"
                    icon={<CheckCircleFilled />}
                    onClick={handleManualCodeSubmit}
                    loading={submittingCode}
                    disabled={!manualUrlInput.trim()}
                  >
                    提交授权码
                  </Button>
                  <Button onClick={() => {
                    setOauthPending(false)
                    if (pollRef.current) clearInterval(pollRef.current)
                  }}>
                    取消
                  </Button>
                </Space>
              </Space>
            </Card>
            <Alert
              type="success"
              showIcon
              message="系统也在自动检测登录状态，完成后会自动跳转。"
            />
          </Space>
        </Card>
      )}

      {/* Device list */}
      {isAuthed && (
        <Card
          className="fg-card-antd"
          title={
            <Space>
              <CloudOutlined /> 米家设备
              <Tag>{devices.length}</Tag>
            </Space>
          }
          bodyStyle={{ padding: 0 }}
          extra={
            <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={devRefreshing}>
              刷新设备
            </Button>
          }
        >
          <Table
            dataSource={devices}
            columns={deviceColumns}
            rowKey="did"
            loading={devLoading}
            size="middle"
            pagination={{ pageSize: 20, showSizeChanger: false }}
            locale={{ emptyText: <Empty description="暂无设备" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
          />
        </Card>
      )}

      {!isAuthed && !oauthPending && (
        <Alert
          type="info"
          showIcon
          style={{ marginTop: 16 }}
          message="米家平台未登录"
          description={'点击「使用米家账号登录」，在弹出的小米登录页面完成 OAuth 登录。'}
        />
      )}
    </div>
  )
}
