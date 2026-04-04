import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Card, Typography, Space, Button, Alert, Tag, Spin, Empty,
  Table, Descriptions, message, Popconfirm, QRCode, Result, Input,
} from 'antd'
import {
  CloudOutlined, QrcodeOutlined, ReloadOutlined,
  LogoutOutlined, CheckCircleOutlined, CloseCircleOutlined, UserOutlined,
} from '@ant-design/icons'
import {
  getPlatforms, PlatformInfo,
  getTuyaQrCode, checkTuyaQrStatus, tuyaLogout,
  getTuyaDevices, refreshTuyaDevices, TuyaDevice,
} from '../services/mcp-client'
import { useAuthStore } from '../stores/authStore'

const { Title, Text } = Typography

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
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '设备ID', dataIndex: 'id', key: 'id', ellipsis: true },
    { title: '类型', dataIndex: 'category', key: 'category',
      render: (v: string) => <Tag>{v || '-'}</Tag> },
    { title: '状态', dataIndex: 'online', key: 'online',
      render: (v: boolean) => v
        ? <Tag color="green" icon={<CheckCircleOutlined />}>在线</Tag>
        : <Tag color="default" icon={<CloseCircleOutlined />}>离线</Tag>
    },
    { title: '房间', dataIndex: 'room_name', key: 'room_name' },
    { title: '家庭', dataIndex: 'home_name', key: 'home_name' },
  ]

  if (!serverOnline) return <Empty description="MCP Server 离线" />

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {contextHolder}
      <Space align="center" style={{ marginBottom: 16 }}>
        <CloudOutlined style={{ fontSize: 24 }} />
        <Title level={3} style={{ margin: 0 }}>涂鸦平台</Title>
      </Space>

      {/* Platform Status */}
      <Card title="平台状态" loading={loading} style={{ marginBottom: 16 }}>
        <Descriptions column={2} size="small">
          <Descriptions.Item label="平台">涂鸦智能</Descriptions.Item>
          <Descriptions.Item label="认证状态">
            {isAuthed
              ? <Tag color="green">已授权</Tag>
              : <Tag color="red">未授权</Tag>
            }
          </Descriptions.Item>
          {tuyaPlatform?.auth_status && (
            <>
              <Descriptions.Item label="用户 UID">
                {(tuyaPlatform.auth_status as any).uid || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Token 剩余">
                {(tuyaPlatform.auth_status as any).token_remaining_seconds
                  ? `${Math.floor(Number((tuyaPlatform.auth_status as any).token_remaining_seconds) / 3600)} 小时`
                  : '-'
                }
              </Descriptions.Item>
            </>
          )}
        </Descriptions>

        <Space style={{ marginTop: 12 }} wrap>
          {!isAuthed && (
            <>
              <Input
                prefix={<UserOutlined />}
                placeholder="涂鸦 App 用户代码"
                value={userCode}
                onChange={(e) => setUserCode(e.target.value)}
                style={{ width: 200 }}
                allowClear
              />
              <Button type="primary" icon={<QrcodeOutlined />}
                onClick={handleGetQr} loading={qrLoading}
                disabled={!userCode.trim()}>
                扫码授权
              </Button>
            </>
          )}
          {isAuthed && (
            <>
              <Button icon={<ReloadOutlined />} onClick={() => fetchPlatforms()}>
                刷新状态
              </Button>
              <Popconfirm title="确定退出涂鸦平台？" onConfirm={handleLogout}>
                <Button danger icon={<LogoutOutlined />}>退出授权</Button>
              </Popconfirm>
            </>
          )}
        </Space>
      </Card>

      {/* QR Code */}
      {qrUrl && (
        <Card title="扫码授权" style={{ marginBottom: 16, textAlign: 'center' }}>
          <Space direction="vertical" align="center" size="middle">
            <QRCode value={qrUrl} size={200} />
            <Text type="secondary">请使用涂鸦智能 App 扫描上方二维码</Text>
            {qrPolling && <Spin tip="等待扫码..." />}
          </Space>
        </Card>
      )}

      {/* Authorized: show device list */}
      {isAuthed && (
        <Card
          title={`涂鸦设备 (${devices.length})`}
          extra={
            <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={devLoading}>
              刷新设备
            </Button>
          }
        >
          {devices.length === 0 && !devLoading ? (
            <Result status="info" title="暂无设备" subTitle="请先在涂鸦 App 中添加设备" />
          ) : (
            <Table
              dataSource={devices}
              columns={deviceColumns}
              rowKey="id"
              loading={devLoading}
              size="small"
              pagination={{ pageSize: 20 }}
            />
          )}
        </Card>
      )}

      {!isAuthed && !qrUrl && (
        <Alert
          type="info"
          showIcon
          message="涂鸦平台未授权"
          description={<>
            1. 打开涂鸦智能 / Smart Life App → 我的 → 设置 → 账号与安全，找到「用户代码」<br />
            2. 在上方输入用户代码，点击「扫码授权」获取二维码<br />
            3. 使用涂鸦智能 App 扫描二维码完成授权
          </>}
          style={{ marginTop: 16 }}
        />
      )}
    </div>
  )
}
