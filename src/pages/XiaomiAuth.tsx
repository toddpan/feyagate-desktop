import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Card, Typography, Space, Button, Tag, Empty,
  Table, Descriptions, message, Popconfirm, Input, Alert,
  Modal, Steps, Divider, Spin, Result, Select,
} from 'antd'
import {
  CloudOutlined, ReloadOutlined, LoginOutlined,
  CheckCircleOutlined, CloseCircleOutlined, SwapOutlined,
  RedoOutlined, ExclamationCircleOutlined, CopyOutlined,
} from '@ant-design/icons'
import {
  getPlatforms, PlatformInfo,
  getAuthStatus, getAuthUrl, authCallback, openOAuth, onAuthCode,
  getDeviceList, refreshDevices, Device, getServerUrl,
} from '../services/mcp-client'
import { useAuthStore } from '../stores/authStore'

const { Title, Text } = Typography

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

  const [authStatus, setAuthStatus] = useState<{ authorized: boolean; cloud_server: string; remaining_seconds: number } | null>(null)
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
        messageApi.success('米家授权成功！')
        fetchPlatforms()
      } catch { /* ignore */ }
    })
    if (window.feyagate?.onAuthSuccess) {
      window.feyagate.onAuthSuccess(() => {
        setOauthPending(false)
        fetchPlatforms()
        messageApi.success('米家授权成功！')
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
        messageApi.error(`启动授权失败: ${e}`)
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
          messageApi.success('米家授权成功！')
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
      messageApi.success('授权成功！')
      fetchPlatforms()
    } catch (e) {
      messageApi.error(`授权失败: ${e}`)
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
            messageApi.success('授权成功！')
            fetchPlatforms()
          } catch (e) { messageApi.error(`授权失败: ${e}`) }
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
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '设备ID', dataIndex: 'did', key: 'did', ellipsis: true },
    { title: '型号', dataIndex: 'model', key: 'model',
      render: (v: string) => <Tag>{v || '-'}</Tag> },
    { title: '状态', dataIndex: 'online', key: 'online',
      render: (v: boolean) => v
        ? <Tag color="green" icon={<CheckCircleOutlined />}>在线</Tag>
        : <Tag color="default" icon={<CloseCircleOutlined />}>离线</Tag>
    },
    { title: '房间', dataIndex: 'room', key: 'room' },
    { title: '家庭', dataIndex: 'home', key: 'home' },
  ]

  if (!serverOnline) return <Empty description="MCP Server 离线" />

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {contextHolder}
      <Space align="center" style={{ marginBottom: 16 }}>
        <CloudOutlined style={{ fontSize: 24 }} />
        <Title level={3} style={{ margin: 0 }}>米家</Title>
      </Space>

      <Card title="平台状态" loading={loading} style={{ marginBottom: 16 }}>
        <Descriptions column={2} size="small">
          <Descriptions.Item label="平台">小米米家</Descriptions.Item>
          <Descriptions.Item label="认证状态">
            {isAuthed ? <Tag color="green">已授权</Tag> : <Tag color="red">未授权</Tag>}
          </Descriptions.Item>
          {authStatus && (
            <>
              <Descriptions.Item label="云服务器">
                {authStatus.cloud_server?.toUpperCase() || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Token 剩余">
                {authStatus.remaining_seconds > 0
                  ? formatRemaining(authStatus.remaining_seconds) : '-'}
              </Descriptions.Item>
            </>
          )}
        </Descriptions>

        <Space style={{ marginTop: 12 }} wrap>
          {!isAuthed && !oauthPending && (
            <>
              <Select
                value={selectedRegion}
                onChange={setSelectedRegion}
                options={REGION_OPTIONS}
                style={{ width: 160 }}
              />
              <Button type="primary" icon={<LoginOutlined />} onClick={handleStartOAuth}>
                使用米家账号登录
              </Button>
            </>
          )}
          {isAuthed && (
            <>
              <Button icon={<ReloadOutlined />} onClick={() => fetchPlatforms()}>
                刷新状态
              </Button>
              <Button icon={<RedoOutlined />} onClick={() => {
                Modal.confirm({
                  title: '重新授权', icon: <ExclamationCircleOutlined />,
                  content: '将重新打开小米登录页面，使用当前账号重新授权。',
                  okText: '重新授权', cancelText: '取消', onOk: handleStartOAuth,
                })
              }}>
                重新授权
              </Button>
              <Popconfirm title="确定切换账号？当前授权将清除" onConfirm={async () => {
                useAuthStore.setState({ authorized: false, cloudServer: '', remainingSeconds: 0 })
                await handleStartOAuth()
              }}>
                <Button danger icon={<SwapOutlined />}>切换账号</Button>
              </Popconfirm>
            </>
          )}
        </Space>
      </Card>

      {oauthPending && (
        <Card title="扫码/登录授权" style={{ marginBottom: 16 }}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Alert type="info" showIcon message="小米登录页面已在弹窗中打开。如果弹窗被浏览器拦截，请允许后重试。" />
            <Steps direction="vertical" size="small" current={1} items={[
              { title: '在弹窗中登录小米账号', status: 'finish' },
              { title: '复制错误页面的地址', status: 'process',
                description: <Text>授权后弹窗会显示"无法访问此网站"— 请复制地址栏 URL</Text> },
              { title: '完成授权', status: 'wait' },
            ]} />
            <Card size="small" style={{ background: 'linear-gradient(135deg, #fff7e6 0%, #fff1f0 100%)', border: '2px solid #fa8c16' }}>
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <Button type="primary" size="large" icon={<CopyOutlined />}
                  onClick={handlePasteFromClipboard} loading={submittingCode} block
                  style={{ height: 48, fontSize: 16 }}>
                  一键粘贴地址并授权
                </Button>
                <Divider plain style={{ margin: '4px 0', fontSize: 12 }}>或手动输入</Divider>
                <Input.TextArea placeholder="粘贴 URL 或输入授权码" value={manualUrlInput}
                  onChange={(e) => setManualUrlInput(e.target.value)}
                  autoSize={{ minRows: 2, maxRows: 4 }} allowClear />
                <Space>
                  <Button type="primary" icon={<CheckCircleOutlined />}
                    onClick={handleManualCodeSubmit} loading={submittingCode}
                    disabled={!manualUrlInput.trim()}>
                    提交授权码
                  </Button>
                  <Button onClick={() => { setOauthPending(false); if (pollRef.current) clearInterval(pollRef.current) }}>取消</Button>
                </Space>
              </Space>
            </Card>
            <Alert type="success" showIcon message="系统也在自动检测授权状态，完成后会自动跳转。" />
          </Space>
        </Card>
      )}

      {isAuthed && (
        <Card
          title={`米家设备 (${devices.length})`}
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
            size="small"
            pagination={{ pageSize: 20 }}
            locale={{ emptyText: '暂无设备' }}
          />
        </Card>
      )}

      {!isAuthed && !oauthPending && (
        <Alert type="info" showIcon
          message="米家平台未授权"
          description={'点击"使用米家账号登录"，在弹出的小米登录页面完成 OAuth 授权。'}
          style={{ marginTop: 16 }}
        />
      )}
    </div>
  )
}
