import { useEffect, useState, useCallback } from 'react'
import {
  Input, Button, Row, Col, Space, Spin, Alert, Empty, Select,
  Card,
} from 'antd'
import {
  ReloadOutlined, SearchOutlined, WifiOutlined,
  CameraOutlined, BulbOutlined, LockOutlined, SoundOutlined,
  DesktopOutlined, AppstoreOutlined, HomeOutlined,
} from '@ant-design/icons'
import { useDeviceStore } from '../stores/deviceStore'
import type { UnifiedDevice } from '../stores/deviceStore'
import { useAuthStore } from '../stores/authStore'
import { getPlatforms, PlatformInfo } from '../services/mcp-client'
import StatusBadge from '../components/StatusBadge'
import { useNavigate } from 'react-router-dom'
import { PageHeader, SoftTag } from '../components/ui'
import { PLATFORM_PRESET } from '../components/ui/PlatformBadge'

const modelIcons: Record<string, React.ReactNode> = {
  camera: <CameraOutlined />,
  light: <BulbOutlined />,
  lock: <LockOutlined />,
  speaker: <SoundOutlined />,
  tv: <DesktopOutlined />,
  router: <WifiOutlined />,
}

function getDeviceIcon(model: string) {
  const lower = (model || '').toLowerCase()
  for (const [key, icon] of Object.entries(modelIcons)) {
    if (lower.includes(key)) return icon
  }
  return <AppstoreOutlined />
}

function isCamera(model: string) {
  return (model || '').toLowerCase().includes('camera')
}

export default function Devices() {
  const {
    devices,
    totalCount,
    loading,
    refreshing,
    error,
    searchKeyword,
    platformFilter,
    fetchDevices,
    refreshDevices,
    setSearchKeyword,
    setPlatformFilter,
    filteredDevices,
  } = useDeviceStore()
  const serverOnline = useAuthStore((s) => s.serverOnline)
  const navigate = useNavigate()

  const [authedPlatforms, setAuthedPlatforms] = useState<string[]>([])

  const loadPlatforms = useCallback(async () => {
    try {
      const plats = await getPlatforms()
      setAuthedPlatforms(
        (plats as PlatformInfo[]).filter((p) => p.authenticated).map((p) => p.platform_id)
      )
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (serverOnline) {
      loadPlatforms()
      fetchDevices()
    }
  }, [serverOnline, loadPlatforms, fetchDevices])

  const displayDevices = filteredDevices()
  const onlineCount = devices.filter((d) => d.online).length
  const cameraCount = devices.filter((d) => isCamera(d.model)).length

  const platformCounts: Record<string, number> = {}
  for (const d of devices) {
    platformCounts[d.platform] = (platformCounts[d.platform] || 0) + 1
  }

  if (!serverOnline) {
    return (
      <div className="fg-page">
        <PageHeader
          icon={<AppstoreOutlined />}
          title="设备列表"
          subtitle="管理已绑定到网关的所有智能设备"
        />
        <div className="fg-empty-state">
          <WifiOutlined />
          <div>MCP 服务器未连接</div>
          <Button style={{ marginTop: 16 }} type="primary" onClick={fetchDevices}>
            重试连接
          </Button>
        </div>
      </div>
    )
  }

  if (authedPlatforms.length === 0 && !loading) {
    return (
      <div className="fg-page">
        <PageHeader
          icon={<AppstoreOutlined />}
          title="设备列表"
          subtitle="管理已绑定到网关的所有智能设备"
        />
        <div className="fg-empty-state">
          <AppstoreOutlined />
          <div style={{ fontSize: 15, color: 'var(--fg-text-secondary)' }}>暂无已登录的平台</div>
          <div style={{ marginBottom: 16 }}>请先在米家、涂鸦等任一平台登录账号</div>
          <Button type="primary" onClick={() => navigate('/platform/xiaomi')}>
            去登录平台
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="fg-page">
      <PageHeader
        icon={<AppstoreOutlined />}
        title="设备列表"
        subtitle={`共 ${totalCount} 台设备 · ${onlineCount} 台在线 · ${cameraCount} 个摄像头`}
        extra={
          <Button
            icon={<ReloadOutlined spin={refreshing} />}
            onClick={refreshDevices}
            loading={refreshing}
          >
            刷新
          </Button>
        }
      />

      {error && (
        <Alert
          message={error}
          type="error"
          showIcon
          closable
          style={{ marginBottom: 16 }}
        />
      )}

      <Card className="fg-card-antd" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col flex="auto">
            <Space wrap size={[12, 8]}>
              <Select
                value={platformFilter || undefined}
                placeholder="全部平台"
                allowClear
                onChange={(v) => setPlatformFilter(v || '')}
                style={{ width: 160 }}
                options={Object.entries(PLATFORM_PRESET)
                  .filter(([key]) => platformCounts[key])
                  .map(([key, { label }]) => ({
                    value: key,
                    label: `${label} (${platformCounts[key]})`,
                  }))}
              />
              <Input
                placeholder="搜索设备名 / 型号 / 房间..."
                prefix={<SearchOutlined />}
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                allowClear
                style={{ width: 260 }}
              />
              <SoftTag tone="success" dot>
                {onlineCount} 在线
              </SoftTag>
              <SoftTag tone="default" dot>
                {totalCount - onlineCount} 离线
              </SoftTag>
              {cameraCount > 0 ? (
                <SoftTag tone="info" dot>
                  {cameraCount} 摄像头
                </SoftTag>
              ) : null}
            </Space>
          </Col>
        </Row>
      </Card>

      <Spin spinning={loading}>
        {displayDevices.length === 0 ? (
          <div className="fg-empty-state">
            <SearchOutlined />
            <div>{searchKeyword || platformFilter ? '未找到匹配设备' : '暂无设备'}</div>
          </div>
        ) : (
          <Row gutter={[16, 16]}>
            {displayDevices.map((device: UnifiedDevice) => {
              const preset = PLATFORM_PRESET[device.platform]
              const color = preset?.color ?? 'var(--fg-border-strong)'
              const cam = isCamera(device.model)
              return (
                <Col xs={24} sm={12} md={8} lg={6} xl={4} key={`${device.platform}-${device.id}`}>
                  <div
                    className={`fg-device-card ${cam ? 'hoverable' : ''}`}
                    style={{ '--pc': device.online ? color : 'var(--fg-border-strong)' } as React.CSSProperties}
                    onClick={cam ? () => navigate('/cameras') : undefined}
                    role={cam ? 'button' : undefined}
                    tabIndex={cam ? 0 : undefined}
                    onKeyDown={(e) => {
                      if (!cam) return
                      if (e.key === 'Enter' || e.key === ' ') navigate('/cameras')
                    }}
                  >
                    <div className="head">
                      <span className={`icon ${!device.online ? 'offline' : ''}`}>
                        {getDeviceIcon(device.model)}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="name" title={device.name}>{device.name}</div>
                        <div className="model" title={device.model}>
                          {device.model || preset?.label || device.platform}
                        </div>
                      </div>
                      <StatusBadge online={device.online} size="small" />
                    </div>
                    <div className="meta">
                      <SoftTag tone="default">{preset?.label ?? device.platform}</SoftTag>
                      {(device.room_name || device.home_name) && (
                        <SoftTag tone="default">
                          <HomeOutlined style={{ marginRight: 2 }} />
                          {device.room_name || device.home_name}
                        </SoftTag>
                      )}
                      {cam && <SoftTag tone="info">摄像头</SoftTag>}
                    </div>
                  </div>
                </Col>
              )
            })}
          </Row>
        )}
      </Spin>
    </div>
  )
}
