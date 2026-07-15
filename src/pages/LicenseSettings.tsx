import { useEffect, useState, useCallback } from 'react'
import {
  Card, Button, Input, Form, message, Modal,
  Spin, Tag, Divider, Empty, Row, Col, Alert, Space,
} from 'antd'
import {
  SyncOutlined, CheckCircleFilled, CloseCircleFilled,
  SafetyCertificateOutlined, KeyOutlined, DeleteOutlined,
  InfoCircleOutlined, LinkOutlined, ReloadOutlined,
  CalendarOutlined, GiftOutlined, CopyOutlined,
  RocketOutlined, CrownOutlined, FireOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'
import { useLicenseStore } from '../stores/licenseStore'
import { useCapabilityStore } from '../stores/capabilityStore'
import { usePlatformAuthStore } from '../stores/platformAuthStore'
import { platformStatusInfo, PLATFORM_LABELS } from '../utils/platformStatus'
import { useNavigate } from 'react-router-dom'
import { getCurrentVersion } from '../services/updater'
import { Hero, PageHeader, SoftTag, StatTile } from '../components/ui'

// 与 Android app/android/.../utils/Constants.java:215 PURCHASE_DOC_URL_BASE
// 同一文档。桌面端 v3 落地追加 from=desktop & ver 用于来源追踪（参考
// docs/design/device-authorization-and-app-purchase.md §4.1 第 3 条）。
const PURCHASE_DOC_URL_BASE =
  'https://bxk64web49.feishu.cn/wiki/OWiQwLdcniaX0PkeA13cpNlDnOb'

function buildPurchaseUrl(): string {
  return `${PURCHASE_DOC_URL_BASE}?from=desktop&ver=${encodeURIComponent(getCurrentVersion())}`
}

const PLATFORM_ROUTE: Record<string, string> = {
  xiaomi: '/platform/xiaomi',
  tuya: '/platform/tuya',
  midea: '/platform/midea',
  ewelink: '/platform/ewelink',
}

function maskKey(key: string) {
  if (!key) return ''
  if (key.length <= 8) return '•'.repeat(key.length)
  return `${key.slice(0, 4)}-••••-••••-${key.slice(-4)}`
}

export default function LicenseSettings() {
  const {
    edition, status, product, keyMasked, deviceId,
    subscriptionExpiresAt, gracePeriodRemaining,
    loading, error, fetchStatus, setLicenseKey, clearLicense,
  } = useLicenseStore()

  const platformDetails = useCapabilityStore((s) => s.platformDetails)
  const fetchCapabilities = useCapabilityStore((s) => s.fetchCapabilities)
  const capGrace = useCapabilityStore((s) => s.gracePeriodRemaining)
  const capExpiresAt = useCapabilityStore((s) => s.subscriptionExpiresAt)
  const authPlatforms = usePlatformAuthStore((s) => s.platforms)
  const fetchAuthPlatforms = usePlatformAuthStore((s) => s.fetchPlatforms)
  const navigate = useNavigate()

  const [keyInput, setKeyInput] = useState('')
  const [productInput, setProductInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [messageApi, contextHolder] = message.useMessage()

  const doFetch = useCallback(() => {
    fetchStatus()
    fetchCapabilities()
    fetchAuthPlatforms()
  }, [fetchStatus, fetchCapabilities, fetchAuthPlatforms])

  useEffect(() => {
    doFetch()
    const timer = setInterval(doFetch, 15000)
    return () => clearInterval(timer)
  }, [doFetch])

  const handleWriteKey = async () => {
    const key = keyInput.trim().toUpperCase()
    if (!key) {
      messageApi.warning('请输入授权码')
      return
    }
    if (!/^FG-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key)) {
      messageApi.warning('授权码格式不正确，应为 FG-XXXX-XXXX-XXXX')
      return
    }

    setSaving(true)
    try {
      const success = await setLicenseKey(key, productInput.trim() || undefined)
      if (success) {
        messageApi.success('授权码写入成功，设备已激活!')
        setKeyInput('')
        setProductInput('')
      } else {
        messageApi.info('授权码已写入，等待云端激活...')
      }
    } catch (e) {
      messageApi.error(e instanceof Error ? e.message : '写入失败')
    } finally {
      setSaving(false)
    }
  }

  const handleClear = () => {
    Modal.confirm({
      title: '确认清除授权',
      icon: <ExclamationCircleOutlined />,
      content: '清除授权后将恢复为免费版，仅支持米家平台。确定要继续吗？',
      okText: '确认清除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        await clearLicense()
        messageApi.success('授权已清除，已恢复为免费版')
      },
    })
  }

  const isLicensed = edition === 'licensed'
  const effectiveGrace = Math.max(gracePeriodRemaining, capGrace)
  const effectiveExpiresAt =
    subscriptionExpiresAt > capExpiresAt ? subscriptionExpiresAt : capExpiresAt
  const expiresAtText =
    effectiveExpiresAt && effectiveExpiresAt.length >= 10
      ? effectiveExpiresAt.substring(0, 10)
      : ''
  const isInGrace = effectiveGrace > 0

  const expiryHint = effectiveGrace > 0
    ? `宽限还剩 ${effectiveGrace} 天`
    : expiresAtText
      ? `到期 ${expiresAtText}`
      : ''

  const statusText =
    status === 'activated'
      ? '已激活'
      : status === 'pending'
        ? '待激活'
        : '未授权'

  const statusTone: 'success' | 'warning' | 'default' =
    status === 'activated' ? 'success' : status === 'pending' ? 'warning' : 'default'

  return (
    <div className="fg-page" style={{ maxWidth: 980, margin: '0 auto' }}>
      {contextHolder}

      <PageHeader
        icon={<SafetyCertificateOutlined />}
        title="设备授权"
        subtitle="管理本机的授权状态、各平台能力以及授权码"
        extra={
          <Button
            icon={<ReloadOutlined spin={loading} />}
            onClick={doFetch}
            loading={loading}
          >
            刷新
          </Button>
        }
      />

      {error && (
        <Alert
          type="error"
          message="获取授权状态失败"
          description={error}
          showIcon
          closable
          style={{ marginBottom: 16 }}
        />
      )}

      {loading && !edition ? (
        <Card className="fg-card-antd" style={{ marginBottom: 20 }}>
          <div style={{ padding: 48, textAlign: 'center' }}>
            <Spin tip="加载中..." />
          </div>
        </Card>
      ) : (
        <>
          {isLicensed ? (
            <div style={{ marginBottom: 20 }}>
              <Hero
                tone={isInGrace ? 'warning' : 'success'}
                icon={
                  isInGrace ? <FireOutlined /> :
                  isLicensed ? <CrownOutlined /> : <SafetyCertificateOutlined />
                }
                title={
                  isInGrace
                    ? `订阅已进入宽限期（${expiryHint || `${effectiveGrace} 天`}）`
                    : `授权版 · ${product ?? '全平台解锁'}`
                }
                description={
                  isInGrace
                    ? '到期后 7 天内设备功能仍可用，过期后将恢复为免费版（仅米家）。请尽快续订。'
                    : `状态：${statusText}${expiresAtText ? ` · 到期 ${expiresAtText}` : ''}`
                }
                actions={
                  isLicensed && (
                    <Space>
                      <Button
                        icon={<KeyOutlined />}
                        onClick={() => {
                          const el = document.getElementById('license-input-section')
                          el?.scrollIntoView({ behavior: 'smooth' })
                        }}
                      >
                        更换授权码
                      </Button>
                      <Button danger icon={<DeleteOutlined />} onClick={handleClear}>
                        清除授权
                      </Button>
                    </Space>
                  )
                }
              />
            </div>
          ) : (
            <div style={{ marginBottom: 20 }}>
              <Hero
                tone="warning"
                icon={<FireOutlined />}
                title="当前为免费版"
                description="仅支持米家平台。如需使用涂鸦 / 美的 / 易微联等更多平台，请输入授权码或前往飞书文档购买。"
                actions={
                  <Space>
                    <Button
                      type="primary"
                      icon={<RocketOutlined />}
                      size="large"
                      onClick={() => {
                        const open = window.feyagate?.openExternal
                          ?? ((u: string) => window.open(u, '_blank'))
                        open(buildPurchaseUrl())
                      }}
                    >
                      购买授权
                    </Button>
                  </Space>
                }
              />
            </div>
          )}

          <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
            <Col xs={12} md={6}>
              <StatTile
                icon={<CrownOutlined />}
                tone={isLicensed ? 'success' : 'warning'}
                label="版本"
                value={isLicensed ? '授权版' : '免费版'}
                trend={product ?? '——'}
              />
            </Col>
            <Col xs={12} md={6}>
              <StatTile
                icon={statusTone === 'success' ? <CheckCircleFilled /> : statusTone === 'warning' ? <SyncOutlined spin /> : <CloseCircleFilled />}
                tone={statusTone === 'success' ? 'success' : statusTone === 'warning' ? 'warning' : 'default'}
                label="授权状态"
                value={statusText}
              />
            </Col>
            <Col xs={12} md={6}>
              <StatTile
                icon={<CalendarOutlined />}
                label={isInGrace ? '宽限期' : '到期'}
                value={
                  isInGrace
                    ? `剩 ${effectiveGrace} 天`
                    : expiresAtText
                      ? expiresAtText
                      : '——'
                }
                trend={isInGrace ? '到期前 7 天内有效' : expiresAtText ? `${product ?? '已激活'} · 自动续订可延长期限` : '尚未绑定到期'}
              />
            </Col>
            <Col xs={12} md={6}>
              <StatTile
                icon={<KeyOutlined />}
                label="授权码"
                value={keyMasked ? maskKey(keyMasked) : '未设置'}
                trend="用于激活与解绑"
              />
            </Col>
          </Row>
        </>
      )}

      {/* Per-platform authorization status */}
      <Card
        className="fg-card-antd"
        title="各平台授权状态"
        style={{ marginBottom: 20 }}
      >
        {(['xiaomi', 'tuya', 'midea', 'ewelink'] as const).map((p) => {
          const d = platformDetails[p]
          const info = platformStatusInfo(
            d?.status,
            d?.trialRemainingDays ?? 0,
            d?.enabled ?? true,
          )
          const plat = authPlatforms.find((ap) => ap.platform_id === p)
          const loggedIn = plat?.authenticated ?? false
          return (
            <div className="fg-platform-row" key={p}>
              <span className="name">{PLATFORM_LABELS[p]}</span>
              <Space wrap size={6} className="tags">
                <SoftTag tone={loggedIn ? 'success' : 'default'} dot>
                  {loggedIn ? '账号已授权' : '账号未授权'}
                </SoftTag>
                <SoftTag
                  tone={
                    info.color === 'red' || info.color === 'volcano'
                      ? 'danger'
                      : info.color === 'gold' || info.color === 'blue'
                        ? info.color === 'gold' ? 'warning' : 'info'
                        : 'default'
                  }
                >
                  {info.text}
                </SoftTag>
                {info.hint ? <span className="hint">{info.hint}</span> : null}
                {d?.message ? <span className="hint">{d.message}</span> : null}
              </Space>
              <Button
                type="link"
                size="small"
                onClick={() => navigate(PLATFORM_ROUTE[p])}
              >
                {loggedIn ? '查看 / 退出 →' : '去授权 →'}
              </Button>
            </div>
          )
        })}
      </Card>

      {/* Input License Key */}
      <Card
        id="license-input-section"
        className="fg-card-antd"
        title={
          <Space>
            <KeyOutlined />
            <span>{isLicensed ? '更换授权码' : '输入授权码'}</span>
          </Space>
        }
        style={{ marginBottom: 20 }}
      >
        <p style={{ color: 'var(--fg-text-secondary)', marginBottom: 16 }}>
          请输入从代理商处获得的设备授权码（格式 <code className="fg-mono">FG-XXXX-XXXX-XXXX</code>），
          写入后设备将自动向云端激活。
        </p>
        <Form layout="vertical">
          <Row gutter={16}>
            <Col xs={24} md={14}>
              <Form.Item
                label="授权码"
                required
                help="格式: FG-XXXX-XXXX-XXXX"
              >
                <Input
                  placeholder="FG-XXXX-XXXX-XXXX"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value.toUpperCase())}
                  onPressEnter={handleWriteKey}
                  maxLength={17}
                  prefix={<KeyOutlined />}
                  allowClear
                  size="large"
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={10}>
              <Form.Item
                label="产品类型"
                help="可选，默认使用配置文件中的产品标识"
              >
                <Input
                  placeholder="feyagate-linux (可选)"
                  value={productInput}
                  onChange={(e) => setProductInput(e.target.value)}
                  allowClear
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              icon={<SafetyCertificateOutlined />}
              loading={saving}
              onClick={handleWriteKey}
              size="large"
            >
              {isLicensed ? '更新授权码' : '写入授权码'}
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card className="fg-card-antd" title="设备 ID">
            <p style={{ color: 'var(--fg-text-secondary)', marginBottom: 12 }}>
              向代理商提供此 ID 以绑定授权。每台设备拥有唯一的设备指纹。
            </p>
            <div className="fg-device-id">
              <code className="fg-mono" style={{ fontSize: 12 }}>{deviceId || '——'}</code>
              <Button
                icon={<CopyOutlined />}
                size="small"
                onClick={async () => {
                  if (!deviceId) return
                  try {
                    await navigator.clipboard.writeText(deviceId)
                    messageApi.success('已复制设备 ID')
                  } catch {
                    messageApi.info('复制失败，请手动选择')
                  }
                }}
              >
                复制
              </Button>
            </div>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card className="fg-card-antd" title="获取授权码">
            <p style={{ color: 'var(--fg-text-secondary)', marginBottom: 12 }}>
              在飞书文档中查看套餐说明、联系客服、获取 16 位授权码，然后回到本页兑换。
            </p>
            <Button
              block
              type="primary"
              size="large"
              icon={<LinkOutlined />}
              onClick={() => {
                const open = window.feyagate?.openExternal
                  ?? ((u: string) => window.open(u, '_blank'))
                open(buildPurchaseUrl())
              }}
            >
              前往飞书文档购买
            </Button>
            <Divider style={{ margin: '16px 0' }} />
            <div style={{ fontSize: 13, color: 'var(--fg-text-secondary)' }}>
              <div style={{ marginBottom: 6 }}>
                <GiftOutlined style={{ marginRight: 6, color: 'var(--fg-success)' }} />
                免费版功能：米家、设备控制、摄像头、小爱音箱、MCP 代理、小智 AI
              </div>
              <div>
                <CrownOutlined style={{ marginRight: 6, color: 'var(--fg-warning)' }} />
                授权版额外功能：涂鸦平台、美的平台、易微联平台
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <Divider />

      {/* Guide */}
      <Card className="fg-card-antd" title={<><InfoCircleOutlined style={{ marginRight: 8 }} />使用指南</>} size="small">
        <div className="fg-guide">
          <div className="step">
            <span className="num">1</span>
            <div className="body">
              <div className="title">联系代理商</div>
              <div className="desc">联系飞阳网关授权版代理商购买授权</div>
            </div>
          </div>
          <div className="step">
            <span className="num">2</span>
            <div className="body">
              <div className="title">获取授权码</div>
              <div className="desc">向代理商提供设备 ID，获取 <code className="fg-mono">FG-XXXX-XXXX-XXXX</code> 格式的 16 位授权码</div>
            </div>
          </div>
          <div className="step">
            <span className="num">3</span>
            <div className="body">
              <div className="title">写入授权码</div>
              <div className="desc">在上方表单中填写授权码并点击「写入授权码」</div>
            </div>
          </div>
          <div className="step">
            <span className="num">4</span>
            <div className="body">
              <div className="title">云端激活</div>
              <div className="desc">系统自动向云端激活，激活后即可使用全部平台功能</div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
