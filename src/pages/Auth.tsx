import { useEffect, useCallback, useRef } from 'react'
import {
  Card,
  Button,
  Descriptions,
  Alert,
  Space,
  Tag,
  Typography,
  Spin,
  Result,
  Divider,
  Input,
  Modal,
  Steps,
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
  KeyOutlined,
  CloudSyncOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '../stores/authStore'
import * as mcp from '../services/mcp-client'
import { getCurrentVersion } from '../services/updater'
import { useUpdateStore } from '../stores/updateStore'
import { useState } from 'react'

const { Title, Text, Link, Paragraph } = Typography

const isElectron = !!window.feyagate
const isEmbeddedWeb = !isElectron && !window.location.protocol.startsWith('file')

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
  const [showManualAuth, setShowManualAuth] = useState(false)
  const [manualUrlInput, setManualUrlInput] = useState('')
  const [submittingCode, setSubmittingCode] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => {
    if (serverOnline) fetchStatus()
  }, [serverOnline, fetchStatus])

  useEffect(() => {
    // Fallback: renderer receives raw code and calls auth/callback itself
    mcp.onAuthCode(async (code) => {
      await handleCallback(code)
      setShowManualAuth(false)
      message.success('授权成功！')
    })

    // Primary: main process already called auth/callback, just refresh UI
    if (window.feyagate?.onAuthSuccess) {
      window.feyagate.onAuthSuccess(() => {
        setShowManualAuth(false)
        fetchStatus()
        message.success('授权成功！')
      })
    }
  }, [handleCallback, fetchStatus])

  useEffect(() => {
    mcp.getServerUrl().then(setServerUrlInput)
  }, [])

  // In browser mode, poll auth status after opening OAuth
  const startBrowserPoll = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const status = await mcp.getAuthStatus()
        if (status.authorized) {
          clearInterval(pollRef.current)
          setShowManualAuth(false)
          fetchStatus()
          message.success('授权成功！')
        }
      } catch { /* ignore */ }
    }, 3000)

    setTimeout(() => clearInterval(pollRef.current), 120000)
  }, [fetchStatus])

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current)
  }, [])

  const handleStartOAuth = useCallback(async () => {
    if (isElectron) {
      await startOAuth()
    } else {
      await startOAuth()
      setShowManualAuth(true)
      startBrowserPoll()
    }
  }, [startOAuth, startBrowserPoll])

  const handleManualCodeSubmit = async () => {
    const code = extractCodeFromUrl(manualUrlInput)
    if (!code) {
      message.error('无法识别授权码，请检查输入')
      return
    }
    setSubmittingCode(true)
    try {
      await handleCallback(code)
      setShowManualAuth(false)
      setManualUrlInput('')
      message.success('授权成功！')
    } catch (e) {
      message.error(`授权失败: ${e}`)
    } finally {
      setSubmittingCode(false)
    }
  }

  const handleSaveUrl = async () => {
    await mcp.setServerUrl(serverUrlInput)
    message.success('服务器地址已更新')
    useAuthStore.getState().checkServer()
  }

  if (!serverOnline) {
    if (isEmbeddedWeb) {
      return (
        <Result
          icon={<Spin size="large" />}
          title="正在连接 MCP 服务器..."
          subTitle="页面由 miloco-mcp-server 提供，正在等待 API 就绪"
          extra={
            <Button type="primary" onClick={() => useAuthStore.getState().checkServer()}>
              重新检测
            </Button>
          }
        />
      )
    }
    return (
      <Result
        status="warning"
        title="MCP 服务器未连接"
        subTitle="请确保 miloco-mcp-server 正在运行"
        extra={
          <Space direction="vertical" align="center" size="large">
            <Text type="secondary">默认地址: http://localhost:38080</Text>
            <Space>
              <Input
                style={{ width: 300 }}
                value={serverUrlInput}
                onChange={(e) => setServerUrlInput(e.target.value)}
                placeholder="http://localhost:38080"
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
              <Title level={4} style={{ margin: 0 }}>{isElectron ? 'FeyaGate Desktop' : 'FeyaGate'}</Title>
              <Text type="secondary">
                飞阳网关 · MCP 大模型智能家居网关 · 已接入小智 / 扣子 / Coze / OpenClaw ·{' '}
                <Link onClick={() => {
                  const open = window.feyagate?.openExternal ?? ((u: string) => { window.open(u, '_blank') })
                  open('https://www.feyagate.com')
                }}>
                  www.feyagate.com
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

          {authorized && !showManualAuth ? (
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
                      onOk: handleStartOAuth,
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
                        await handleStartOAuth()
                      },
                    })
                  }}
                >
                  切换账号
                </Button>
              </Space>
            </Space>
          ) : showManualAuth ? (
            <ManualAuthSection
              onSubmit={handleManualCodeSubmit}
              urlInput={manualUrlInput}
              setUrlInput={setManualUrlInput}
              submitting={submittingCode}
              onCancel={() => {
                setShowManualAuth(false)
                if (pollRef.current) clearInterval(pollRef.current)
              }}
            />
          ) : (
            <Space direction="vertical" size="middle" style={{ width: '100%', textAlign: 'center' }}>
              <Text type="secondary">连接您的小米账号以管理智能设备和摄像头</Text>
              <Button
                type="primary"
                size="large"
                icon={<LoginOutlined />}
                onClick={handleStartOAuth}
                loading={loading}
              >
                使用米家账号登录
              </Button>
            </Space>
          )}

          {showSettings && (
            <SettingsSection
              serverUrlInput={serverUrlInput}
              setServerUrlInput={setServerUrlInput}
              onSave={handleSaveUrl}
            />
          )}
        </Card>
      </Spin>
    </Space>
  )
}

function ManualAuthSection({
  onSubmit,
  urlInput,
  setUrlInput,
  submitting,
  onCancel,
}: {
  onSubmit: () => void
  urlInput: string
  setUrlInput: (v: string) => void
  submitting: boolean
  onCancel: () => void
}) {
  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="浏览器模式 — 需要手动完成授权"
        description="小米登录页面已在新标签页打开。登录后页面会跳转到一个无法访问的地址，这是正常的。请按下面的步骤完成授权。"
      />

      <Steps
        direction="vertical"
        size="small"
        current={1}
        items={[
          {
            title: '小米登录',
            description: '在新打开的标签页中完成小米账号登录',
            status: 'finish',
          },
          {
            title: '复制重定向地址',
            description: (
              <Space direction="vertical" size={4}>
                <Text>登录成功后，页面会跳转并显示"无法访问此网站"。</Text>
                <Text strong>请复制浏览器地址栏中的完整 URL</Text>
                <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                  地址格式类似: <Text code>https://127.0.0.1/?code=xxxxxxxx</Text>
                </Paragraph>
              </Space>
            ),
            status: 'process',
          },
          {
            title: '粘贴完成授权',
            description: '将复制的地址粘贴到下方输入框',
            status: 'wait',
          },
        ]}
      />

      <Card size="small" style={{ background: '#fafafa' }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Text strong><KeyOutlined /> 粘贴重定向 URL 或授权码：</Text>
          <Input.TextArea
            placeholder="粘贴完整的 https://127.0.0.1/?code=xxx 地址，或直接输入授权码"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            autoSize={{ minRows: 2, maxRows: 4 }}
            allowClear
          />
          <Space>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={onSubmit}
              loading={submitting}
              disabled={!urlInput.trim()}
            >
              提交授权码
            </Button>
            <Button onClick={onCancel}>取消</Button>
          </Space>
        </Space>
      </Card>

      <Alert
        type="warning"
        showIcon
        message="系统也在自动检测授权状态，如果服务端已收到授权码，页面会自动跳转。"
      />
    </Space>
  )
}

function SettingsSection({
  serverUrlInput,
  setServerUrlInput,
  onSave,
}: {
  serverUrlInput: string
  setServerUrlInput: (v: string) => void
  onSave: () => void
}) {
  const { hasUpdate, updateInfo, checking, check } = useUpdateStore()
  const version = getCurrentVersion()

  return (
    <>
      <Divider />
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Space>
          <Text>服务器地址:</Text>
          <Input
            style={{ width: 300 }}
            value={serverUrlInput}
            onChange={(e) => setServerUrlInput(e.target.value)}
          />
          <Button onClick={onSave}>保存</Button>
        </Space>

        <Divider style={{ margin: '4px 0' }} />

        <Space wrap align="center">
          <Text><InfoCircleOutlined /> 版本: <Text strong>v{version}</Text></Text>
          <Button
            size="small"
            icon={<CloudSyncOutlined />}
            loading={checking}
            onClick={() => {
              useUpdateStore.setState({ dismissed: false })
              check()
            }}
          >
            检查更新
          </Button>
          {hasUpdate && updateInfo && (
            <Tag color="blue">新版本 v{updateInfo.version} 可用</Tag>
          )}
          {!hasUpdate && !checking && (
            <Text type="secondary">已是最新版本</Text>
          )}
        </Space>
      </Space>
    </>
  )
}
