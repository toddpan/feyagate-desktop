import { useEffect, useState, useCallback } from 'react'
import {
  Card, Input, Button, Row, Col, Space, Typography,
  Spin, Alert, Empty, Tag, Statistic, Tooltip, Select,
} from 'antd'
import {
  ReloadOutlined, SearchOutlined, WifiOutlined, HomeOutlined,
  CameraOutlined, BulbOutlined, LockOutlined, SoundOutlined,
  DesktopOutlined, AppstoreOutlined, CloudOutlined,
} from '@ant-design/icons'
import { useDeviceStore } from '../stores/deviceStore'
import type { UnifiedDevice } from '../stores/deviceStore'
import { useAuthStore } from '../stores/authStore'
import { getPlatforms, PlatformInfo } from '../services/mcp-client'
import StatusBadge from '../components/StatusBadge'
import { useNavigate } from 'react-router-dom'

const { Text } = Typography

const PLATFORM_LABELS: Record<string, { label: string; color: string }> = {
  xiaomi:  { label: '米家',   color: '#ff6900' },
  tuya:    { label: '涂鸦',   color: '#1890ff' },
  midea:   { label: '美的',   color: '#52c41a' },
  ewelink: { label: '易微联', color: '#722ed1' },
}

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
    return <Empty description="MCP 服务器未连接" />
  }

  if (authedPlatforms.length === 0 && !loading) {
    return (
      <Empty description="暂无已授权的平台">
        <Button type="primary" onClick={() => navigate('/platform/xiaomi')}>
          去授权平台
        </Button>
      </Empty>
    )
  }

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      {error && <Alert message={error} type="error" showIcon closable />}

      <Card size="small">
        <Row gutter={16} align="middle">
          <Col flex="auto">
            <Space size="large" wrap>
              <Statistic title="总设备" value={totalCount} />
              <Statistic title="在线" value={onlineCount} valueStyle={{ color: '#52c41a' }} />
              {Object.entries(platformCounts).map(([p, count]) => (
                <Statistic
                  key={p}
                  title={PLATFORM_LABELS[p]?.label || p}
                  value={count}
                  prefix={<CloudOutlined style={{ color: PLATFORM_LABELS[p]?.color }} />}
                />
              ))}
            </Space>
          </Col>
          <Col>
            <Space wrap>
              <Select
                value={platformFilter || undefined}
                placeholder="全部平台"
                allowClear
                onChange={(v) => setPlatformFilter(v || '')}
                style={{ width: 130 }}
                options={[
                  ...Object.entries(PLATFORM_LABELS)
                    .filter(([key]) => platformCounts[key])
                    .map(([key, { label }]) => ({
                      value: key,
                      label: `${label} (${platformCounts[key]})`,
                    })),
                ]}
              />
              <Input
                placeholder="搜索设备、型号、房间..."
                prefix={<SearchOutlined />}
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                allowClear
                style={{ width: 220 }}
              />
              <Button
                icon={<ReloadOutlined spin={refreshing} />}
                onClick={refreshDevices}
                loading={refreshing}
              >
                刷新
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Spin spinning={loading}>
        {displayDevices.length === 0 ? (
          <Empty description={searchKeyword || platformFilter ? '未找到匹配设备' : '暂无设备'} />
        ) : (
          <Row gutter={[12, 12]}>
            {displayDevices.map((device: UnifiedDevice) => {
              const pInfo = PLATFORM_LABELS[device.platform]
              return (
                <Col xs={24} sm={12} md={8} lg={6} key={`${device.platform}-${device.id}`}>
                  <Card
                    size="small"
                    hoverable={isCamera(device.model)}
                    onClick={
                      isCamera(device.model)
                        ? () => navigate('/cameras')
                        : undefined
                    }
                    style={{
                      borderLeft: `3px solid ${
                        isCamera(device.model)
                          ? '#1677ff'
                          : device.online
                            ? pInfo?.color || '#52c41a'
                            : '#d9d9d9'
                      }`,
                    }}
                  >
                    <Space direction="vertical" size={2} style={{ width: '100%' }}>
                      <Space>
                        <span style={{ fontSize: 18 }}>{getDeviceIcon(device.model)}</span>
                        <Text strong ellipsis style={{ maxWidth: 120 }}>
                          {device.name}
                        </Text>
                        <StatusBadge online={device.online} size="small" />
                      </Space>
                      <Tooltip title={device.model}>
                        <Text type="secondary" ellipsis style={{ fontSize: 12, maxWidth: '100%' }}>
                          {device.model || '-'}
                        </Text>
                      </Tooltip>
                      <Space size={4} wrap>
                        <Tag
                          color={pInfo?.color}
                          bordered={false}
                          style={{ fontSize: 11 }}
                        >
                          {pInfo?.label || device.platform}
                        </Tag>
                        {(device.room_name || device.home_name) && (
                          <Tag icon={<HomeOutlined />} bordered={false} color="default">
                            {device.room_name || device.home_name}
                          </Tag>
                        )}
                        {isCamera(device.model) && (
                          <Tag color="blue" bordered={false}>摄像头</Tag>
                        )}
                      </Space>
                    </Space>
                  </Card>
                </Col>
              )
            })}
          </Row>
        )}
      </Spin>
    </Space>
  )
}
