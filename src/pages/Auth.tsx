import { useEffect } from 'react'
import {
  Card,
  Button,
  Descriptions,
  Alert,
  Space,
  Typography,
  Spin,
  Result,
  Divider,
  Input,
  Modal,
  message,
} from 'antd'
import {
  CheckCircleOutlined,
  LoginOutlined,
  CloudOutlined,
  ClockCircleOutlined,
  SettingOutlined,
  ApiOutlined,
  SwapOutlined,
  RedoOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '../stores/authStore'
import { onAuthCode, getServerUrl, setServerUrl } from '../services/mcp-client'
import { useState } from 'react'

const { Title, Text, Link } = Typography

function formatRemaining(seconds: number): string {
  if (seconds <= 0) return '已过期'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 24) return `${Math.floor(h / 24)} 天 ${h % 24} 小时`
  if (h > 0) return `${h} 小时 ${m} 分钟`
  return `${m} 分钟`
}

export default function Auth() {
  const {
    authorized,
    cloudServer,
    remainingSeconds,
    loading,
    error,
    serverOnline,
    fetchStatus,
    startOAuth,
    handleCallback,
  } = useAuthStore()

  const [serverUrlInput, setServerUrlInput] = useState('')
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    if (serverOnline) fetchStatus()
  }, [serverOnline, fetchStatus])

  useEffect(() => {
    onAuthCode(async (code) => {
      await handleCallback(code)
      message.success('授权成功！')
    })
  }, [handleCallback])

  useEffect(() => {
    getServerUrl().then(setServerUrlInput)
  }, [])

  const handleSaveUrl = async () => {
    await setServerUrl(serverUrlInput)
    message.success('服务器地址已更新')
    useAuthStore.getState().checkServer()
  }

  if (!serverOnline) {
    return (
      <Result
        status="warning"
        title="MCP 服务器未连接"
        subTitle="请确保 miloco-mcp-server 正在运行"
        extra={
          <Space direction="vertical" align="center" size="large">
            <Text type="secondary">默认地址: http://localhost:8080</Text>
            <Space>
              <Input
                style={{ width: 300 }}
                value={serverUrlInput}
                onChange={(e) => setServerUrlInput(e.target.value)}
                placeholder="http://localhost:8080"
              />
              <Button onClick={handleSaveUrl}>保存</Button>
            </Space>
            <Button type="primary" onClick={() => useAuthStore.getState().checkServer()}>
              重新检测
            </Button>
          </Space>
        }
      />
    )
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Space align="center">
            <ApiOutlined style={{ fontSize: 32, color: '#1677ff' }} />
            <div>
              <Title level={4} style={{ margin: 0 }}>FeyaGate Desktop</Title>
              <Text type="secondary">
                飞阳网关 · 小米智能设备管理 ·{' '}
                <Link onClick={() => {
                  const open = window.feyagate?.openExternal ?? ((u: string) => { window.open(u, '_blank') })
                  open('https://feya.sooncore.com')
                }}>
                  feya.sooncore.com
                </Link>
              </Text>
            </div>
          </Space>
        </Space>
      </Card>

      <Spin spinning={loading}>
        <Card
          title={
            <Space>
              <CloudOutlined />
              <span>米家账号授权</span>
            </Space>
          }
          extra={
            <Button
              icon={<SettingOutlined />}
              size="small"
              type="text"
              onClick={() => setShowSettings(!showSettings)}
            />
          }
        >
          {error && (
            <Alert message={error} type="error" showIcon closable style={{ marginBottom: 16 }} />
          )}

          {authorized ? (
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Result
                status="success"
                icon={<CheckCircleOutlined />}
                title="已授权"
                subTitle="小米账号已成功连接"
              />
              <Descriptions bordered column={1} size="small">
                <Descriptions.Item label={<><CloudOutlined /> 云服务器</>}>
                  {cloudServer.toUpperCase()}
                </Descriptions.Item>
                <Descriptions.Item label={<><ClockCircleOutlined /> Token 剩余</>}>
                  {formatRemaining(remainingSeconds)}
                </Descriptions.Item>
              </Descriptions>
              <Space wrap>
                <Button onClick={fetchStatus}>刷新状态</Button>
                <Button
                  icon={<RedoOutlined />}
                  onClick={() => {
                    Modal.confirm({
                      title: '重新授权',
                      icon: <ExclamationCircleOutlined />,
                      content: '将重新打开小米登录页面，使用当前账号重新授权。适用于 Token 过期或需要刷新权限的情况。',
                      okText: '重新授权',
                      cancelText: '取消',
                      onOk: startOAuth,
                    })
                  }}
                >
                  重新授权
                </Button>
                <Button
                  icon={<SwapOutlined />}
                  danger
                  onClick={() => {
                    Modal.confirm({
                      title: '切换账号',
                      icon: <ExclamationCircleOutlined />,
                      content: '将清除当前授权信息并打开小米登录页面。您可以使用另一个小米账号登录。切换后当前设备列表将被刷新。',
                      okText: '确认切换',
                      okButtonProps: { danger: true },
                      cancelText: '取消',
                      onOk: async () => {
                        useAuthStore.setState({
                          authorized: false,
                          cloudServer: '',
                          remainingSeconds: 0,
                        })
                        await startOAuth()
                      },
                    })
                  }}
                >
                  切换账号
                </Button>
              </Space>
            </Space>
          ) : (
            <Space direction="vertical" size="middle" style={{ width: '100%', textAlign: 'center' }}>
              <Text type="secondary">连接您的小米账号以管理智能设备和摄像头</Text>
              <Button
                type="primary"
                size="large"
                icon={<LoginOutlined />}
                onClick={startOAuth}
                loading={loading}
              >
                使用米家账号登录
              </Button>
            </Space>
          )}

          {showSettings && (
            <>
              <Divider />
              <Space>
                <Text>服务器地址:</Text>
                <Input
                  style={{ width: 300 }}
                  value={serverUrlInput}
                  onChange={(e) => setServerUrlInput(e.target.value)}
                />
                <Button onClick={handleSaveUrl}>保存</Button>
              </Space>
            </>
          )}
        </Card>
      </Spin>
    </Space>
  )
}
