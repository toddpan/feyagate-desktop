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
  CopyOutlined,
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
  const [oauthPending, setOauthPending] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval>>()
  const popupRef = useRef<Window | null>(null)
  const prevAuthorizedRef = useRef(authorized && remainingSeconds > 0)

  useEffect(() => {
    if (serverOnline) fetchStatus()
  }, [serverOnline, fetchStatus])

  // Check URL params for auth result (after server redirect)
  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('auth=success')) {
      fetchStatus()
      setShowManualAuth(false)
      setOauthPending(false)
      message.success('授权成功！')
      window.location.hash = '#/'
    } else if (hash.includes('auth=failed')) {
      message.error('授权失败，请重试')
      window.location.hash = '#/'
    }
  }, [fetchStatus])

  useEffect(() => {
    mcp.onAuthCode(async (code) => {
      await handleCallback(code)
      setShowManualAuth(false)
      setOauthPending(false)
      message.success('授权成功！')
    })

    if (window.feyagate?.onAuthSuccess) {
      window.feyagate.onAuthSuccess(() => {
        setShowManualAuth(false)
        setOauthPending(false)
        fetchStatus()
        message.success('授权成功！')
      })
    }
  }, [handleCallback, fetchStatus])

  useEffect(() => {
    mcp.getServerUrl().then(setServerUrlInput)
  }, [])

  // Poll auth status — only trigger success when transitioning to valid auth
  const startBrowserPoll = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    prevAuthorizedRef.current = false
    pollRef.current = setInterval(async () => {
      try {
        const status = await mcp.getAuthStatus()
        if (status.authorized && status.remaining_seconds > 0 && !prevAuthorizedRef.current) {
          prevAuthorizedRef.current = true
          clearInterval(pollRef.current)
          setShowManualAuth(false)
          setOauthPending(false)
          if (popupRef.current && !popupRef.current.closed) {
            popupRef.current.close()
          }
          fetchStatus()
          message.success('授权成功！')
        }
      } catch { /* ignore */ }
    }, 3000)

    setTimeout(() => {
      if (pollRef.current) clearInterval(pollRef.current)
    }, 300000)
  }, [fetchStatus])

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current)
  }, [])

  const handleStartOAuth = useCallback(async () => {
    if (isElectron) {
      await startOAuth()
    } else {
      try {
        const url = await mcp.getAuthUrl()
        const serverUrl = await mcp.getServerUrl()
        const callbackBase = serverUrl || window.location.origin

        // Try server-side browser OAuth flow first (requires updated server)
        // Falls back to direct popup if /auth/browser-start is not available
        let popup: Window | null = null
        try {
          const testResp = await fetch(`${callbackBase}/auth/browser-start`, {
            method: 'HEAD',
            signal: AbortSignal.timeout(2000),
          })
          if (testResp.ok || testResp.status === 200) {
            popup = window.open(
              `${callbackBase}/auth/browser-start?callback=${encodeURIComponent(callbackBase + '/auth/callback')}&oauth_url=${encodeURIComponent(url)}`,
              'xiaomi_oauth',
              'width=520,height=700,popup=true,scrollbars=yes'
            )
          }
        } catch { /* endpoint not available, use fallback */ }

        if (!popup || popup.closed) {
          popup = window.open(url, 'xiaomi_oauth', 'width=520,height=700,popup=true,scrollbars=yes')
        }

        popupRef.current = popup
        setShowManualAuth(true)
        setOauthPending(true)
        startBrowserPoll()

        // Monitor popup close
        const checkClosed = setInterval(() => {
          if (popup && popup.closed) {
            clearInterval(checkClosed)
          }
        }, 1000)
        setTimeout(() => clearInterval(checkClosed), 300000)
      } catch (e) {
        message.error(`启动授权失败: ${e}`)
      }
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
      setOauthPending(false)
      setManualUrlInput('')
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close()
      }
      message.success('授权成功！')
    } catch (e) {
      message.error(`授权失败: ${e}`)
    } finally {
      setSubmittingCode(false)
    }
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
            await handleCallback(code)
            setShowManualAuth(false)
            setOauthPending(false)
            setManualUrlInput('')
            if (popupRef.current && !popupRef.current.closed) {
              popupRef.current.close()
            }
            message.success('授权成功！')
          } catch (e) {
            message.error(`授权失败: ${e}`)
          } finally {
            setSubmittingCode(false)
          }
        }
      }
    } catch {
      message.info('请手动粘贴地址到输入框')
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
                setOauthPending(false)
                if (pollRef.current) clearInterval(pollRef.current)
              }}
              onPaste={handlePasteFromClipboard}
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
  onPaste,
}: {
  onSubmit: () => void
  urlInput: string
  setUrlInput: (v: string) => void
  submitting: boolean
  onCancel: () => void
  onPaste: () => void
}) {
  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="浏览器模式授权"
        description="小米登录页面已在弹窗中打开。如果弹窗被浏览器拦截，请允许弹窗后重试。"
      />

      <Steps
        direction="vertical"
        size="small"
        current={1}
        items={[
          {
            title: '在弹窗中登录小米账号',
            description: '点击"确认授权"完成小米账号登录',
            status: 'finish',
          },
          {
            title: '复制错误页面的地址',
            description: (
              <Space direction="vertical" size={4}>
                <Text>授权后弹窗会显示 <Text strong>"无法访问此网站"</Text> — 这是正常的！</Text>
                <Text type="danger" strong>请复制弹窗地址栏中的完整 URL，然后点击下方按钮粘贴</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  地址类似: <Text code>https://127.0.0.1/?code=xxxxxxxx</Text>
                </Text>
              </Space>
            ),
            status: 'process',
          },
          {
            title: '完成授权',
            description: '系统自动提取授权码并完成登录',
            status: 'wait',
          },
        ]}
      />

      <Card
        size="small"
        style={{
          background: 'linear-gradient(135deg, #fff7e6 0%, #fff1f0 100%)',
          border: '2px solid #fa8c16',
        }}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Button
            type="primary"
            size="large"
            icon={<CopyOutlined />}
            onClick={onPaste}
            loading={submitting}
            block
            style={{ height: 48, fontSize: 16 }}
          >
            一键粘贴地址并授权
          </Button>

          <Divider plain style={{ margin: '4px 0', fontSize: 12 }}>或手动输入</Divider>

          <Input.TextArea
            placeholder="粘贴 https://127.0.0.1/?code=xxx 完整地址，或直接输入授权码"
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
        type="success"
        showIcon
        message="系统也在自动检测授权状态，如果授权已完成会自动跳转。"
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
