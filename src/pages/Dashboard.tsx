import { useEffect, useState, useCallback } from 'react'
import { Row, Col, Button, Empty, Spin, Tag, List, Card } from 'antd'
import {
  ReloadOutlined,
  EyeOutlined,
  ThunderboltOutlined,
  ApiOutlined,
  ClockCircleOutlined,
  RobotOutlined,
  SyncOutlined,
  CloudOutlined,
  HomeOutlined,
  NodeIndexOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  ArrowRightOutlined,
  FireOutlined,
  DashboardOutlined,
} from '@ant-design/icons'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import {
  getDashboard, DashboardResult, getTokenUsage, DailyTokenStat,
  getCameraStatus, CameraStatusResult, getCameraList,
} from '../services/mcp-client'
import { useAuthStore } from '../stores/authStore'
import { usePlatformAuthStore } from '../stores/platformAuthStore'
import { useCapabilityStore } from '../stores/capabilityStore'
import { useLicenseStore } from '../stores/licenseStore'
import { platformStatusInfo, PLATFORM_LABELS } from '../utils/platformStatus'
import { useNavigate } from 'react-router-dom'
import {
  Hero, PageHeader, SoftTag, StatTile, PlatformDot,
} from '../components/ui'

const PLATFORM_ROUTE: Record<string, string> = {
  xiaomi: '/platform/xiaomi',
  tuya: '/platform/tuya',
  midea: '/platform/midea',
  ewelink: '/platform/ewelink',
}

const PLATFORM_COLOR: Record<string, string> = {
  xiaomi: '#ff6900',
  tuya: '#1890ff',
  midea: '#52c41a',
  ewelink: '#722ed1',
}

const PLATFORM_ICON: Record<string, React.ReactNode> = {
  xiaomi: <CloudOutlined />,
  tuya: <CloudOutlined />,
  midea: <HomeOutlined />,
  ewelink: <NodeIndexOutlined />,
}

export default function Dashboard() {
  const serverOnline = useAuthStore((s) => s.serverOnline)
  const navigate = useNavigate()
  const authPlatforms = usePlatformAuthStore((s) => s.platforms)
  const fetchAuthPlatforms = usePlatformAuthStore((s) => s.fetchPlatforms)
  const capDetails = useCapabilityStore((s) => s.platformDetails)
  const fetchCapabilities = useCapabilityStore((s) => s.fetchCapabilities)
  const licenseEdition = useLicenseStore((s) => s.edition)

  const [dash, setDash] = useState<DashboardResult | null>(null)
  const [dailyTokens, setDailyTokens] = useState<DailyTokenStat[]>([])
  const [cameraStatus, setCameraStatus] = useState<CameraStatusResult | null>(null)
  const [totalCameras, setTotalCameras] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [dashData, tokenData, camStatus, camList] = await Promise.all([
        getDashboard(),
        getTokenUsage(7),
        getCameraStatus().catch(() => null),
        getCameraList().catch(() => null),
      ])
      setDash(dashData)
      setDailyTokens(tokenData.daily ?? [])
      if (camStatus) setCameraStatus(camStatus)
      if (camList) setTotalCameras(camList.cameras.length)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (serverOnline) {
      fetchData()
      fetchAuthPlatforms()
      fetchCapabilities()
      const timer = setInterval(() => {
        fetchAuthPlatforms()
        fetchCapabilities()
      }, 15000)
      return () => clearInterval(timer)
    }
  }, [serverOnline, fetchData, fetchAuthPlatforms, fetchCapabilities])

  if (!serverOnline) {
    return (
      <div className="fg-page">
        <Hero
          tone="danger"
          icon={<CloseCircleFilled />}
          title="MCP Server 未连接"
          description="请先启动本地 MCP Server，连接恢复后此处会自动刷新。"
          actions={
            <Button icon={<ReloadOutlined />} onClick={() => fetchData()}>
              重试
            </Button>
          }
        />
      </div>
    )
  }

  const today = dash?.today
  const tokenSummary = dash?.token_summary
  const connectedCameras = cameraStatus?.connected_count ?? 0
  const cameraOnlineRate = totalCameras > 0
    ? Math.round((connectedCameras / totalCameras) * 100)
    : 0

  const authedPlatforms = authPlatforms.filter((p) => p.authenticated).length
  const totalPlatforms = 4 // xiaomi, tuya, midea, ewelink

  const isLicensed = licenseEdition === 'licensed'

  return (
    <div className="fg-page">
      <PageHeader
        icon={<DashboardOutlined />}
        title="数据看板"
        subtitle="一眼看清你的网关、平台、设备与今天的运行状态"
        extra={
          <Button
            icon={<ReloadOutlined spin={loading} />}
            onClick={fetchData}
            loading={loading}
          >
            刷新
          </Button>
        }
      />

      {/* Hero: overall status */}
      <div style={{ marginBottom: 20 }}>
        <Hero
          tone={isLicensed ? 'default' : 'warning'}
          icon={isLicensed ? <CheckCircleFilled /> : <FireOutlined />}
          title={
            isLicensed
              ? '授权版 · 全部功能可用'
              : '免费版 · 仅米家可用'
          }
          description={
            isLicensed
              ? `${authedPlatforms}/${totalPlatforms} 个平台已授权 · 今日 ${today?.ai_calls ?? 0} 次 AI 调用`
              : '升级授权版可解锁涂鸦 / 美的 / 易微联 等更多平台'
          }
          actions={
            <Button type="primary" onClick={() => navigate('/license')}>
              管理授权
            </Button>
          }
        />
      </div>

      {loading && !dash ? (
        <Card>
          <div style={{ padding: 60, textAlign: 'center' }}>
            <Spin tip="加载中..." />
          </div>
        </Card>
      ) : (
        <>
          {/* Top KPI grid */}
          <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
            <Col xs={12} sm={12} md={6}>
              <StatTile
                icon={<RobotOutlined />}
                label="今日 AI 调用"
                value={today?.ai_calls ?? 0}
                suffix="次"
              />
            </Col>
            <Col xs={12} sm={12} md={6}>
              <StatTile
                icon={<ThunderboltOutlined />}
                label="今日触发"
                value={today?.triggers ?? 0}
                suffix="次"
                tone="success"
              />
            </Col>
            <Col xs={12} sm={12} md={6}>
              <StatTile
                icon={<ApiOutlined />}
                label="执行动作"
                value={today?.actions_executed ?? 0}
                suffix="次"
                tone="warning"
              />
            </Col>
            <Col xs={12} sm={12} md={6}>
              <StatTile
                icon={<EyeOutlined />}
                label="Token 消耗"
                value={(today?.tokens_used ?? 0).toLocaleString()}
                suffix="tokens"
                tone="info"
              />
            </Col>
          </Row>

          {/* Platforms grid */}
          <div style={{ marginBottom: 20 }}>
            <div className="fg-card-section-title">平台授权状态</div>
            <Row gutter={[16, 16]}>
              {(['xiaomi', 'tuya', 'midea', 'ewelink'] as const).map((id) => {
                const plat = authPlatforms.find((p) => p.platform_id === id)
                const cap = capDetails[id]
                const isLoggedIn = plat?.authenticated ?? false
                const capInfo = platformStatusInfo(
                  cap?.status,
                  cap?.trialRemainingDays ?? 0,
                  cap?.enabled ?? true,
                )
                const color = PLATFORM_COLOR[id]

                return (
                  <Col xs={24} sm={12} md={6} key={id}>
                    <div
                      className="fg-card fg-card-platform hoverable"
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(PLATFORM_ROUTE[id])}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') navigate(PLATFORM_ROUTE[id])
                      }}
                      style={{ '--pc': color } as React.CSSProperties}
                    >
                      <div className="row">
                        <span className="icon-wrap">{PLATFORM_ICON[id]}</span>
                        <span className="name">{PLATFORM_LABELS[id]}</span>
                        <PlatformDot platform={id} size={8} />
                      </div>
                      <div className="tags">
                        <SoftTag tone={isLoggedIn ? 'success' : 'default'} dot>
                          {isLoggedIn ? '账号已授权' : '账号未授权'}
                        </SoftTag>
                        <SoftTag
                          tone={
                            capInfo.color === 'red' || capInfo.color === 'volcano'
                              ? 'danger'
                              : capInfo.color === 'gold'
                                ? 'warning'
                                : capInfo.color === 'blue'
                                  ? 'info'
                                  : 'default'
                          }
                        >
                          {capInfo.text}
                        </SoftTag>
                      </div>
                      {cap?.message ? (
                        <div className="hint">{cap.message}</div>
                      ) : null}
                      <div className="cta">
                        <span>{isLoggedIn ? '管理' : '去授权'}</span>
                        <ArrowRightOutlined />
                      </div>
                    </div>
                  </Col>
                )
              })}
            </Row>
          </div>

          {/* Charts & recent events */}
          <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
            <Col xs={24} lg={14}>
              <Card title="Token 趋势 · 最近 7 天" className="fg-card-antd">
                {dailyTokens.length ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={dailyTokens} barCategoryGap="32%">
                      <XAxis
                        dataKey="date"
                        tickFormatter={(v) => (v ? v.slice(5) : '')}
                        tick={{ fill: 'var(--fg-text-tertiary)', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: 'var(--fg-text-tertiary)', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <RechartsTooltip
                        cursor={{ fill: 'rgba(22,119,255,0.06)' }}
                        contentStyle={{
                          borderRadius: 10,
                          border: '1px solid var(--fg-border)',
                          boxShadow: 'var(--fg-shadow-md)',
                          fontSize: 12,
                        }}
                        formatter={(v) => Number(v ?? 0).toLocaleString()}
                      />
                      <Bar dataKey="prompt_tokens" stackId="a" fill="#1677ff" radius={[0, 0, 0, 0]} />
                      <Bar
                        dataKey="completion_tokens"
                        stackId="a"
                        fill="#52c41a"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Empty description="暂无 Token 数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
                <div style={{ display: 'flex', gap: 20, marginTop: 8, fontSize: 12, color: 'var(--fg-text-tertiary)' }}>
                  <span><span style={{ display: 'inline-block', width: 8, height: 8, background: '#1677ff', borderRadius: 2, marginRight: 6 }} />Prompt</span>
                  <span><span style={{ display: 'inline-block', width: 8, height: 8, background: '#52c41a', borderRadius: 2, marginRight: 6 }} />Completion</span>
                </div>
              </Card>
            </Col>
            <Col xs={24} lg={10}>
              <Card title="最近触发事件" className="fg-card-antd">
                {dash?.recent_events?.length ? (
                  <List
                    size="small"
                    split={false}
                    dataSource={dash.recent_events}
                    renderItem={(item) => (
                      <div className="fg-event-item">
                        <div className="dot" />
                        <div className="body">
                          <div className="title">{item.rule_name}</div>
                          <div className="meta">
                            <ClockCircleOutlined /> {new Date(item.time).toLocaleString('zh-CN')}
                          </div>
                        </div>
                      </div>
                    )}
                  />
                ) : (
                  <Empty description="今日暂无触发" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </Card>
            </Col>
          </Row>

          {/* Action ranking */}
          {dash?.action_ranking?.length ? (
            <Card title="执行动作排名" className="fg-card-antd" style={{ marginBottom: 20 }}>
              <ResponsiveContainer width="100%" height={Math.max(180, dash.action_ranking.length * 40)}>
                <BarChart data={dash.action_ranking} layout="vertical" barCategoryGap="40%">
                  <XAxis type="number" allowDecimals={false} tick={{ fill: 'var(--fg-text-tertiary)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="action" width={200} tick={{ fill: 'var(--fg-text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <RechartsTooltip
                    cursor={{ fill: 'rgba(22,119,255,0.06)' }}
                    contentStyle={{ borderRadius: 10, border: '1px solid var(--fg-border)' }}
                  />
                  <Bar dataKey="count" name="执行次数" radius={[0, 6, 6, 0]}>
                    {dash.action_ranking.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? '#1677ff' : '#91caff'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          ) : null}

          {/* System status row */}
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={8}>
              <StatTile
                icon={<EyeOutlined />}
                label="Vision AI"
                value={tokenSummary?.total_calls ? '已使用' : '未使用'}
                tone={tokenSummary?.total_calls ? 'success' : 'default'}
              />
            </Col>
            <Col xs={24} sm={12} md={8}>
              <StatTile
                icon={<SyncOutlined spin={dash?.trigger_engine?.enabled ?? false} />}
                label="触发引擎"
                value={dash?.trigger_engine?.enabled ? '运行中' : '未启用'}
                tone={dash?.trigger_engine?.enabled ? 'success' : 'warning'}
                trend={
                  dash?.trigger_engine?.enabled
                    ? `${dash.trigger_engine.enabled_rules ?? 0}/${dash.trigger_engine.total_rules ?? 0} 规则已启用`
                    : '前往触发规则页启用'
                }
              />
            </Col>
            <Col xs={24} sm={12} md={8}>
              <StatTile
                icon={<ApiOutlined />}
                label="摄像头"
                value={`${connectedCameras}/${totalCameras}`}
                suffix="在线"
                tone={cameraOnlineRate >= 80 ? 'success' : cameraOnlineRate > 0 ? 'warning' : 'default'}
                trend={totalCameras > 0 ? `在线率 ${cameraOnlineRate}%` : '尚未添加摄像头'}
              />
            </Col>
          </Row>
        </>
      )}
    </div>
  )
}
