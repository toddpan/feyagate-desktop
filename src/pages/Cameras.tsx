import { useEffect, useRef } from 'react'
import {
  Card,
  Button,
  Space,
  Typography,
  Spin,
  Alert,
  Empty,
  Tag,
  Row,
  Col,
  Image,
  Descriptions,
  InputNumber,
  Divider,
} from 'antd'
import {
  CameraOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  PictureOutlined,
  ReloadOutlined,
  HomeOutlined,
} from '@ant-design/icons'
import { useCameraStore } from '../stores/cameraStore'
import { useAuthStore } from '../stores/authStore'
import StatusBadge from '../components/StatusBadge'
import { useState } from 'react'

const { Text, Title } = Typography

export default function Cameras() {
  const {
    cameras,
    statusMap,
    snapshots,
    loading,
    connecting,
    error,
    fetchCameras,
    fetchStatus,
    connect,
    disconnect,
    takeSnapshot,
    clearError,
  } = useCameraStore()
  const authorized = useAuthStore((s) => s.authorized)
  const serverOnline = useAuthStore((s) => s.serverOnline)
  const [snapshotCount, setSnapshotCount] = useState(1)
  const pollRef = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => {
    if (serverOnline && authorized) {
      fetchCameras()
      fetchStatus()
    }
  }, [serverOnline, authorized, fetchCameras, fetchStatus])

  useEffect(() => {
    if (serverOnline && authorized) {
      pollRef.current = setInterval(() => fetchStatus(), 3000)
      return () => clearInterval(pollRef.current)
    }
  }, [serverOnline, authorized, fetchStatus])

  if (!serverOnline) return <Empty description="MCP 服务器未连接" />
  if (!authorized) return <Empty description="请先完成米家账号授权" />

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      {error && (
        <Alert message={error} type="error" showIcon closable onClose={clearError} />
      )}

      <Card
        size="small"
        title={<Space><CameraOutlined /> 摄像头管理</Space>}
        extra={
          <Button
            icon={<ReloadOutlined />}
            size="small"
            onClick={() => { fetchCameras(); fetchStatus() }}
          >
            刷新
          </Button>
        }
      >
        <Text type="secondary">
          共 {cameras.length} 个摄像头 ·{' '}
          {Object.values(statusMap).filter((s) => s.status === 'streaming').length} 个已连接
        </Text>
      </Card>

      <Spin spinning={loading}>
        {cameras.length === 0 ? (
          <Empty description="未发现摄像头设备" />
        ) : (
          <Row gutter={[16, 16]}>
            {cameras.map((camera) => {
              const status = statusMap[camera.did]
              const isConnected = status?.status === 'streaming'
              const isConnecting = connecting === camera.did
              const cameraSnapshots = snapshots[camera.did] ?? []

              return (
                <Col xs={24} lg={12} key={camera.did}>
                  <Card
                    title={
                      <Space>
                        <CameraOutlined />
                        <Text strong>{camera.name}</Text>
                        <StatusBadge online={camera.online} />
                        {isConnected && (
                          <Tag color="blue" bordered={false}>流媒体中</Tag>
                        )}
                      </Space>
                    }
                  >
                    <Descriptions size="small" column={2} style={{ marginBottom: 12 }}>
                      <Descriptions.Item label="型号">{camera.model}</Descriptions.Item>
                      <Descriptions.Item label="设备 ID">
                        <Text copyable style={{ fontSize: 12 }}>{camera.did}</Text>
                      </Descriptions.Item>
                      <Descriptions.Item label={<><HomeOutlined /> 位置</>}>
                        {camera.room} · {camera.home}
                      </Descriptions.Item>
                      <Descriptions.Item label="通道数">{camera.channel_count}</Descriptions.Item>
                      {status && (
                        <Descriptions.Item label="缓冲帧数">
                          {status.buffered_frames}
                        </Descriptions.Item>
                      )}
                    </Descriptions>

                    <Space wrap>
                      {!isConnected ? (
                        <Button
                          type="primary"
                          icon={<PlayCircleOutlined />}
                          onClick={() => connect(camera.did)}
                          loading={isConnecting}
                          disabled={!camera.online}
                        >
                          连接
                        </Button>
                      ) : (
                        <Button
                          danger
                          icon={<PauseCircleOutlined />}
                          onClick={() => disconnect(camera.did)}
                          loading={isConnecting}
                        >
                          断开
                        </Button>
                      )}
                      <Space.Compact>
                        <InputNumber
                          min={1}
                          max={10}
                          value={snapshotCount}
                          onChange={(v) => setSnapshotCount(v ?? 1)}
                          style={{ width: 60 }}
                          size="middle"
                        />
                        <Button
                          icon={<PictureOutlined />}
                          onClick={() => takeSnapshot(camera.did, snapshotCount)}
                          disabled={!isConnected}
                        >
                          抓拍
                        </Button>
                      </Space.Compact>
                    </Space>

                    {cameraSnapshots.length > 0 && (
                      <>
                        <Divider style={{ margin: '12px 0' }} />
                        <Title level={5} style={{ marginBottom: 8 }}>
                          <PictureOutlined /> 快照 ({cameraSnapshots.length})
                        </Title>
                        <Image.PreviewGroup>
                          <Row gutter={[8, 8]}>
                            {cameraSnapshots.map((src, i) => (
                              <Col span={cameraSnapshots.length === 1 ? 24 : 12} key={i}>
                                <Image
                                  src={src}
                                  alt={`Snapshot ${i + 1}`}
                                  style={{
                                    borderRadius: 8,
                                    width: '100%',
                                    maxHeight: 300,
                                    objectFit: 'contain',
                                    background: '#000',
                                  }}
                                />
                              </Col>
                            ))}
                          </Row>
                        </Image.PreviewGroup>
                      </>
                    )}
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
