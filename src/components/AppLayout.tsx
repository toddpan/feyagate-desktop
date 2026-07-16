import React, { useEffect, useMemo, useRef } from 'react'
import { Layout, Menu, Tooltip } from 'antd'
import {
  DashboardOutlined,
  CameraOutlined,
  AppstoreOutlined,
  ThunderboltOutlined,
  SafetyCertificateOutlined,
  EyeOutlined,
  AlertOutlined,
  HistoryOutlined,
  DollarOutlined,
  BarChartOutlined,
  CloudOutlined,
  HomeOutlined,
  NodeIndexOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  BulbOutlined,
  ShopOutlined,
  BookOutlined,
  GlobalOutlined,
  LinkOutlined,
  ApiOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useLicenseStore } from '../stores/licenseStore'
import { useCapabilityStore } from '../stores/capabilityStore'
import { usePlatformAuthStore } from '../stores/platformAuthStore'
import { useUserStore } from '../stores/userStore'
import { isCameraSupported } from '../services/mcp-client'
import { SoftTag, PLATFORM_PRESET } from './ui'

const { Sider, Header, Content } = Layout

const cameraSupported = isCameraSupported()

const platformKeyMap: Record<string, string> = {
  '/platform/tuya': 'tuya',
  '/platform/midea': 'midea',
  '/platform/ewelink': 'ewelink',
  '/platform/xiaomi': 'xiaomi',
}

interface NavGroup {
  label?: string
  items: { key: string; icon: React.ReactNode; label: React.ReactNode; disabled?: boolean }[]
}

function buildGroups(isPlatformEnabled: (p: string) => boolean): NavGroup[] {
  const platformItems = [
    { key: '/platform/xiaomi', icon: <CloudOutlined />, label: '米家' },
    { key: '/platform/tuya', icon: <CloudOutlined />, label: '涂鸦智能' },
    { key: '/platform/midea', icon: <HomeOutlined />, label: '美的美居' },
    { key: '/platform/ewelink', icon: <NodeIndexOutlined />, label: '易微联' },
    { key: '/xiaozhi', icon: <ThunderboltOutlined />, label: '小智平台' },
  ].map((item) => {
    const platform = platformKeyMap[item.key]
    if (platform && !isPlatformEnabled(platform)) {
      return {
        ...item,
        label: (
          <Tooltip title="升级授权版解锁此平台" placement="right">
            <span style={{ opacity: 0.7 }}>{item.label as string}</span>
          </Tooltip>
        ),
        disabled: true,
      }
    }
    return item
  })

  const cameraItem: NavGroup['items'][number] = cameraSupported
    ? { key: '/cameras', icon: <CameraOutlined />, label: '摄像头' }
    : {
        key: '/cameras',
        icon: <CameraOutlined />,
        label: (
          <Tooltip title="Windows 平台暂不支持" placement="right">
            <span style={{ opacity: 0.45 }}>摄像头</span>
          </Tooltip>
        ),
        disabled: true,
      }

  return [
    {
      items: [
        { key: '/', icon: <DashboardOutlined />, label: '数据看板' },
      ],
    },
    {
      label: '平台集成',
      items: platformItems,
    },
    {
      label: '设备管理',
      items: [
        { key: '/devices', icon: <AppstoreOutlined />, label: '设备列表' },
        cameraItem,
      ],
    },
    {
      label: 'AI 与自动化',
      items: [
        { key: '/memory', icon: <FileTextOutlined />, label: '记忆' },
        { key: '/skills', icon: <BulbOutlined />, label: '技能' },
        { key: '/skill-store', icon: <ShopOutlined />, label: '技能商店' },
        { key: '/schedules', icon: <ClockCircleOutlined />, label: '定时任务' },
        { key: '/vision', icon: <EyeOutlined />, label: 'Vision AI' },
        { key: '/triggers', icon: <AlertOutlined />, label: '触发规则' },
        { key: '/trigger-logs', icon: <HistoryOutlined />, label: '触发日志' },
      ],
    },
    {
      label: '统计与系统',
      items: [
        { key: '/stats/tokens', icon: <DollarOutlined />, label: 'Token 统计' },
        { key: '/stats/triggers', icon: <BarChartOutlined />, label: '触发统计' },
        { key: '/license', icon: <SafetyCertificateOutlined />, label: '设备授权' },
        { key: '/docs', icon: <BookOutlined />, label: '接口文档' },
      ],
    },
  ]
}

interface Props {
  children: React.ReactNode
}

const HEADER_PLATFORMS = [
  { id: 'xiaomi', label: '米家', route: '/platform/xiaomi' },
  { id: 'tuya', label: '涂鸦', route: '/platform/tuya' },
  { id: 'midea', label: '美的', route: '/platform/midea' },
  { id: 'ewelink', label: '易微联', route: '/platform/ewelink' },
  { id: 'ha', label: 'HA', route: '/platform/ha' },
] as const

function PlatformBadgeStrip() {
  const navigate = useNavigate()
  const authPlatforms = usePlatformAuthStore((s) => s.platforms)
  const capDetails = useCapabilityStore((s) => s.platformDetails)

  return (
    <div className="fg-platform-strip">
      {HEADER_PLATFORMS.map((p) => {
        const loggedIn = authPlatforms.some((ap) => ap.platform_id === p.id && ap.authenticated)
        const cap = capDetails[p.id]
        const capBlocked = cap?.enabled === false
        const preset = PLATFORM_PRESET[p.id]
        const color = preset?.color ?? 'var(--fg-text-tertiary)'
        const tip = capBlocked
          ? `${p.label} · 授权版不可用`
          : loggedIn
            ? `${p.label} · 账号已登录`
            : `${p.label} · 账号未登录`
        const dotColor = capBlocked
          ? 'var(--fg-danger)'
          : loggedIn
            ? color
            : 'var(--fg-text-tertiary)'

        return (
          <Tooltip key={p.id} title={tip} placement="bottom">
            <button
              type="button"
              className="fg-platform-pill"
              onClick={() => navigate(p.route)}
              style={
                loggedIn
                  ? {
                      color,
                      borderColor: `${color}33`,
                      background: `${color}14`,
                    }
                  : undefined
              }
            >
              <span className="dot" style={{ background: dotColor }} />
              {p.label}
            </button>
          </Tooltip>
        )
      })}
    </div>
  )
}

function Brand() {
  return (
    <div className="fg-brand">
      <div className="logo">
        <ApiOutlined />
      </div>
      <div className="wordmark">
        <span className="primary">FeyaGate</span>
        <span className="secondary">Desktop</span>
      </div>
    </div>
  )
}

export default function AppLayout({ children }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const serverOnline = useAuthStore((s) => s.serverOnline)
  const checkServer = useAuthStore((s) => s.checkServer)
  const licenseEdition = useLicenseStore((s) => s.edition)
  const fetchLicense = useLicenseStore((s) => s.fetchStatus)
  const capPlatforms = useCapabilityStore((s) => s.platforms)
  const fetchCapabilities = useCapabilityStore((s) => s.fetchCapabilities)
  const restoreSession = useUserStore((s) => s.restoreSession)
  const fetchAuthPlatforms = usePlatformAuthStore((s) => s.fetchPlatforms)
  const timerRef = useRef<ReturnType<typeof setInterval>>()

  const groups = useMemo(
    () => buildGroups((p: string) => capPlatforms[p] !== false),
    [capPlatforms]
  )

  useEffect(() => {
    restoreSession()
  }, [restoreSession])

  useEffect(() => {
    const resetPolling = () => {
      clearInterval(timerRef.current)
      timerRef.current = setInterval(() => {
        checkServer()
        fetchCapabilities()
        fetchAuthPlatforms()
      }, 15000)
    }

    checkServer()
    fetchLicense()
    fetchCapabilities()
    fetchAuthPlatforms()
    resetPolling()

    const unsub = useAuthStore.subscribe((s, prev) => {
      if (s.serverOnline !== prev.serverOnline) {
        resetPolling()
      }
    })

    return () => {
      clearInterval(timerRef.current)
      unsub()
    }
  }, [checkServer, fetchLicense, fetchCapabilities, fetchAuthPlatforms])

  // selected keys cascade for parent menu paths
  const selectedKey = useMemo(() => {
    const path = location.pathname
    for (const g of groups) {
      if (g.items.some((it) => it.key === path)) return path
    }
    const matchedItem = groups
      .flatMap((g) => g.items)
      .filter((it) => path.startsWith(it.key) && it.key !== '/')
      .sort((a, b) => b.key.length - a.key.length)[0]
    return matchedItem?.key ?? path
  }, [groups, location.pathname])

  return (
    <Layout className="fg-app-layout">
      <Sider
        width={232}
        collapsedWidth={68}
        breakpoint="lg"
        className="fg-sider"
        trigger={null}
      >
        <Brand />
        <div className="fg-menu-wrap">
          {groups.map((g, gi) => (
            <div className="fg-menu-group" key={gi}>
              {g.label ? <div className="fg-menu-title">{g.label}</div> : null}
              <Menu
                mode="inline"
                selectedKeys={[selectedKey]}
                items={g.items.map((it) => ({
                  key: it.key,
                  icon: it.icon,
                  label: it.label,
                  disabled: it.disabled,
                }))}
                onClick={({ key }) => navigate(key as string)}
              />
            </div>
          ))}
        </div>
        <div className="fg-sider-footer">
          <a
            href="https://www.feyagate.com"
            target="_blank"
            rel="noreferrer"
            onClick={(e) => {
              e.preventDefault()
              const open = window.feyagate?.openExternal ?? ((u: string) => window.open(u, '_blank'))
              open('https://www.feyagate.com')
            }}
          >
            <GlobalOutlined />
            <span>www.feyagate.com</span>
          </a>
        </div>
      </Sider>
      <Layout className="fg-app-main">
        <Header className="fg-header">
          <div className="fg-header-left">
            <span className="crumbs">
              {selectedKey === '/' ? '概览' : menuLabelOf(selectedKey)}
            </span>
          </div>
          <div className="fg-header-right">
            {serverOnline ? <PlatformBadgeStrip /> : null}
            {serverOnline ? (
              <SoftTag
                tone={licenseEdition === 'licensed' ? 'success' : 'warning'}
                dot
              >
                {licenseEdition === 'licensed' ? '授权版' : '免费版'}
              </SoftTag>
            ) : null}
            <SoftTag tone={serverOnline ? 'success' : 'danger'} dot>
              MCP Server {serverOnline ? '在线' : '离线'}
            </SoftTag>
            <Tooltip title="访问官网">
              <button
                type="button"
                className="fg-icon-btn"
                onClick={() => {
                  const open = window.feyagate?.openExternal ?? ((u: string) => window.open(u, '_blank'))
                  open('https://www.feyagate.com')
                }}
              >
                <LinkOutlined />
              </button>
            </Tooltip>
          </div>
        </Header>
        <Content className="fg-content">{children}</Content>
      </Layout>
    </Layout>
  )
}

function menuLabelOf(key: string): string {
  const map: Record<string, string> = {
    '/devices': '设备 / 设备列表',
    '/cameras': '设备 / 摄像头',
    '/platform/xiaomi': '平台集成 / 米家',
    '/platform/tuya': '平台集成 / 涂鸦',
    '/platform/midea': '平台集成 / 美的',
    '/platform/ewelink': '平台集成 / 易微联',
    '/xiaozhi': '平台集成 / 小智',
    '/memory': 'AI 与自动化 / 记忆',
    '/skills': 'AI 与自动化 / 技能',
    '/skill-store': 'AI 与自动化 / 技能商店',
    '/schedules': 'AI 与自动化 / 定时任务',
    '/vision': 'AI 与自动化 / Vision AI',
    '/triggers': 'AI 与自动化 / 触发规则',
    '/trigger-logs': 'AI 与自动化 / 触发日志',
    '/stats/tokens': '统计 / Token 统计',
    '/stats/triggers': '统计 / 触发统计',
    '/license': '系统 / 设备授权',
    '/docs': '系统 / 接口文档',
  }
  return map[key] ?? key
}
