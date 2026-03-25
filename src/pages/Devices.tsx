import { useEffect } from 'react'
import {
  Card,
  Input,
  Button,
  Row,
  Col,
  Space,
  Typography,
  Spin,
  Alert,
  Empty,
  Tag,
  Statistic,
  Tooltip,
} from 'antd'
import {
  ReloadOutlined,
  SearchOutlined,
  WifiOutlined,
  HomeOutlined,
  CameraOutlined,
  BulbOutlined,
  LockOutlined,
  SoundOutlined,
  DesktopOutlined,
  AppstoreOutlined,
} from '@ant-design/icons'
import { useDeviceStore } from '../stores/deviceStore'
import { useAuthStore } from '../stores/authStore'
import StatusBadge from '../components/StatusBadge'
import { useNavigate } from 'react-router-dom'

const { Text } = Typography

const modelIcons: Record<string, React.ReactNode> = {
  camera: <CameraOutlined />,
  light: <BulbOutlined />,
  lock: <LockOutlined />,
  speaker: <SoundOutlined />,
  tv: <DesktopOutlined />,
  router: <WifiOutlined />,
}

function getDeviceIcon(model: string) {
  for (const [key, icon] of Object.entries(modelIcons)) {
    if (model.toLowerCase().includes(key)) return icon
  }
  return <AppstoreOutlined />
}

function isCamera(model: string) {
  return model.toLowerCase().includes('camera')
}

export default function Devices() {
  const {
    devices,
    totalCount,
    loading,
    refreshing,
    error,
    searchKeyword,
    fetchDevices,
    refreshDevices,
    setSearchKeyword,
    filteredDevices,
  } = useDeviceStore()
  const authorized = useAuthStore((s) => s.authorized)
  const serverOnline = useAuthStore((s) => s.serverOnline)
  const navigate = useNavigate()

  useEffect(() => {
    if (serverOnline && authorized) fetchDevices()
  }, [serverOnline, authorized, fetchDevices])

  const displayDevices = filteredDevices()
  const onlineCount = devices.filter((d) => d.online).length
  const cameraCount = devices.filter((d) => isCamera(d.model)).length

  if (!serverOnline) {
    return <Empty description="MCP 服务器未连接" />
  }
  if (!authorized) {
    return <Empty description="请先完成米家账号授权" />
  }

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      {error && <Alert message={error} type="error" showIcon closable />}

      <Card size="small">
        <Row gutter={16} align="middle">
          <Col flex="auto">
            <Space size="large">
              <Statistic title="总设备" value={totalCount} />
              <Statistic title="在线" value={onlineCount} valueStyle={{ color: '#52c41a' }} />
              <Statistic title="摄像头" value={cameraCount} prefix={<CameraOutlined />} />
            </Space>
          </Col>
          <Col>
            <Space>
              <Input
                placeholder="搜索设备、型号、房间..."
                prefix={<SearchOutlined />}
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                allowClear
                style={{ width: 240 }}
              />
              <Button
                icon={<ReloadOutlined spin={refreshing} />}
                onClick={refreshDevices}
                loading={refreshing}
              >
                云端刷新
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Spin spinning={loading}>
        {displayDevices.length === 0 ? (
          <Empty description="未找到设备" />
        ) : (
          <Row gutter={[12, 12]}>
            {displayDevices.map((device) => (
              <Col xs={24} sm={12} md={8} lg={6} key={device.did}>
                <Card
                  size="small"
                  hoverable={isCamera(device.model)}
                  onClick={
                    isCamera(device.model)
                      ? () => navigate('/cameras')
                      : undefined
                  }
                  style={{
                    borderLeft: isCamera(device.model)
                      ? '3px solid #1677ff'
                      : device.online
                        ? '3px solid #52c41a'
                        : undefined,
                  }}
                >
                  <Space direction="vertical" size={2} style={{ width: '100%' }}>
                    <Space>
                      <span style={{ fontSize: 18 }}>{getDeviceIcon(device.model)}</span>
                      <Text strong ellipsis style={{ maxWidth: 140 }}>
                        {device.name}
                      </Text>
                      <StatusBadge online={device.online} size="small" />
                    </Space>
                    <Tooltip title={device.model}>
                      <Text type="secondary" ellipsis style={{ fontSize: 12, maxWidth: '100%' }}>
                        {device.model}
                      </Text>
                    </Tooltip>
                    <Space size={4}>
                      <Tag icon={<HomeOutlined />} bordered={false} color="default">
                        {device.room || device.home}
                      </Tag>
                      {isCamera(device.model) && (
                        <Tag color="blue" bordered={false}>摄像头</Tag>
                      )}
                    </Space>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Spin>
    </Space>
  )
}
