import { useEffect, useRef, useState } from 'react'
import {
  Button, Space, Spin, Alert, Card, Row, Col, Image,
  InputNumber, Divider, Empty, Tag, Result,
} from 'antd'
import {
  CameraOutlined, PlayCircleOutlined, PauseCircleOutlined,
  PictureOutlined, ReloadOutlined, HomeOutlined, VideoCameraOutlined,
  PoweroffOutlined, CameraFilled,
  CheckCircleFilled, CloseCircleFilled, SyncOutlined,
} from '@ant-design/icons'
import { useCameraStore } from '../stores/cameraStore'
import { useAuthStore } from '../stores/authStore'
import { isCameraSupported } from '../services/mcp-client'
import { useNavigate } from 'react-router-dom'
import { PageHeader, SoftTag, StatTile, Hero } from '../components/ui'

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
  const navigate = useNavigate()

  useEffect(() => {
    if (serverOnline && authorized && isCameraSupported()) {
      fetchCameras()
      fetchStatus()
    }
  }, [serverOnline, authorized, fetchCameras, fetchStatus])

  useEffect(() => {
    if (serverOnline && authorized && isCameraSupported()) {
      pollRef.current = setInterval(() => fetchStatus(), 3000)
      return () => clearInterval(pollRef.current)
    }
  }, [serverOnline, authorized, fetchStatus])

  if (!serverOnline) {
    return (
      <div className="fg-page">
        <PageHeader icon={<CameraOutlined />} title="摄像头" subtitle="实时预览、抓拍、回看" />
        <Hero
          tone="danger"
          icon={<CloseCircleFilled />}
          title="MCP 服务器未连接"
          description="请先启动本地 MCP Server，连接恢复后此处会自动刷新。"
          actions={
            <Button icon={<ReloadOutlined />} onClick={() => { fetchCameras(); fetchStatus() }}>
              重试
            </Button>
          }
        />
      </div>
    )
  }

  if (!authorized) {
    return (
      <div className="fg-page">
        <PageHeader icon={<CameraOutlined />} title="摄像头" subtitle="实时预览、抓拍、回看" />
        <div className="fg-empty-state">
          <CameraOutlined />
          <div style={{ fontSize: 15, color: 'var(--fg-text-secondary)' }}>请先完成米家账号登录</div>
          <div style={{ marginBottom: 16 }}>摄像头功能依赖米家平台账号</div>
          <Button type="primary" onClick={() => navigate('/platform/xiaomi')}>
            去登录米家
          </Button>
        </div>
      </div>
    )
  }

  if (!isCameraSupported()) {
    return (
      <div className="fg-page">
        <PageHeader icon={<CameraOutlined />} title="摄像头" subtitle="实时预览、抓拍、回看" />
        <Hero
          tone="warning"
          icon={<VideoCameraOutlined />}
          title="当前平台暂不支持摄像头功能"
          description="摄像头连接和抓拍功能依赖米家 P2P 协议库，目前仅支持 macOS 和 Linux (Ubuntu)。"
        />
        <Alert
          type="info"
          showIcon
          style={{ marginTop: 16 }}
          message="平台支持说明"
          description={
            <ul style={{ margin: '8px 0', paddingLeft: 20, color: 'var(--fg-text-secondary)' }}>
              <li><strong>macOS</strong> — 完整支持（x86_64 / arm64）</li>
              <li><strong>Linux (Ubuntu)</strong> — 完整支持（x86_64 / arm64）</li>
              <li><strong>Windows</strong> — 暂不支持，后续版本将添加</li>
            </ul>
          }
        />
      </div>
    )
  }

  const connectedCount = Object.values(statusMap).filter(
    (s) => s.status === 'connected' || s.status === 'streaming'
  ).length
  const errorCount = Object.values(statusMap).filter((s) => s.status === 'error').length

  return (
    <div className="fg-page">
      <PageHeader
        icon={<CameraOutlined />}
        title="摄像头"
        subtitle={`共 ${cameras.length} 个摄像头 · ${connectedCount} 个在线 · ${errorCount} 个异常`}
        extra={
          <Button
            icon={<ReloadOutlined />}
            onClick={() => { fetchCameras(); fetchStatus() }}
            loading={loading}
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
          onClose={clearError}
          style={{ marginBottom: 16 }}
        />
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} md={6}>
          <StatTile
            icon={<VideoCameraOutlined />}
            label="摄像头总数"
            value={cameras.length}
            suffix="台"
          />
        </Col>
        <Col xs={12} md={6}>
          <StatTile
            icon={<CheckCircleFilled />}
            tone="success"
            label="在线"
            value={connectedCount}
            suffix="台"
          />
        </Col>
        <Col xs={12} md={6}>
          <StatTile
            icon={<CloseCircleFilled />}
            tone={errorCount > 0 ? 'danger' : 'default'}
            label="连接异常"
            value={errorCount}
            suffix="台"
          />
        </Col>
        <Col xs={12} md={6}>
          <StatTile
            icon={<PictureOutlined />}
            tone="info"
            label="今日抓拍"
            value={Object.values(snapshots).reduce((a, b) => a + b.length, 0)}
            suffix="张"
          />
        </Col>
      </Row>

      <Spin spinning={loading}>
        {cameras.length === 0 ? (
          <div className="fg-empty-state">
            <CameraOutlined />
            <div>未发现摄像头设备</div>
            <div style={{ marginTop: 12, fontSize: 13 }}>
              请确认米家账号下已添加摄像头设备并完成刷新
            </div>
          </div>
        ) : (
          <Row gutter={[16, 16]}>
            {cameras.map((camera) => {
              const status = statusMap[camera.did]
              const isConnected = status?.status === 'connected' || status?.status === 'streaming'
              const isConnecting = connecting === camera.did
              const isReconnecting = status?.status === 'reconnecting' || status?.status === 'connecting'
              const isError = status?.status === 'error'
              const cameraSnapshots = snapshots[camera.did] ?? []

              return (
                <Col xs={24} lg={12} key={camera.did}>
                  <div className="fg-camera-card">
                    <div className={`preview ${isConnected ? 'live' : ''}`}>
                      {isConnected ? (
                        <>
                          <span className="pulse" />
                          <CameraFilled style={{ fontSize: 24 }} />
                          <span>实时预览中</span>
                        </>
                      ) : isReconnecting ? (
                        <>
                          <SyncOutlined spin style={{ fontSize: 24 }} />
                          <span>正在连接...</span>
                        </>
                      ) : isError ? (
                        <>
                          <CloseCircleFilled style={{ fontSize: 24, color: '#f87171' }} />
                          <span>连接失败，请重试</span>
                        </>
                      ) : (
                        <>
                          <CameraOutlined style={{ fontSize: 32 }} />
                          <span>未连接</span>
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>点击下方「连接」开始预览</span>
                        </>
                      )}
                    </div>
                    <div className="body">
                      <div className="name">
                        <CameraOutlined />
                        {camera.name}
                        {isConnected && <SoftTag tone="success" dot>在线</SoftTag>}
                        {!camera.online && <SoftTag tone="default">设备离线</SoftTag>}
                      </div>
                      <div className="meta">
                        <HomeOutlined style={{ marginRight: 4 }} />
                        {camera.room || '-'} · {camera.home || '-'} · {camera.model || '-'} · 通道 {camera.channel_count}
                      </div>
                      {status && (
                        <div className="meta" style={{ marginTop: 4 }}>
                          缓冲帧 {status.buffered_frames ?? 0}
                        </div>
                      )}
                    </div>
                    <div className="actions">
                      {!isConnected ? (
                        <Button
                          type="primary"
                          icon={<PlayCircleOutlined />}
                          onClick={() => connect(camera.did)}
                          loading={isConnecting}
                        >
                          {!camera.online ? '尝试连接' : '连接'}
                        </Button>
                      ) : (
                        <Button
                          icon={<PoweroffOutlined />}
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
                          style={{ width: 64 }}
                        />
                        <Button
                          icon={<PictureOutlined />}
                          onClick={() => takeSnapshot(camera.did, snapshotCount)}
                          disabled={!isConnected}
                        >
                          抓拍
                        </Button>
                      </Space.Compact>
                    </div>

                    {cameraSnapshots.length > 0 && (
                      <div style={{ padding: '0 16px 16px' }}>
                        <Divider style={{ margin: '8px 0 12px' }} orientation="left" orientationMargin={0}>
                          <span style={{ fontSize: 12, color: 'var(--fg-text-tertiary)' }}>
                            <PictureOutlined /> 快照 ({cameraSnapshots.length})
                          </span>
                        </Divider>
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
                                    maxHeight: 240,
                                    objectFit: 'cover',
                                    background: '#0f172a',
                                  }}
                                />
                              </Col>
                            ))}
                          </Row>
                        </Image.PreviewGroup>
                      </div>
                    )}
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
