import React, { useEffect, useRef } from 'react'
import { Layout, Menu, Badge, Typography, Space, theme, Tooltip } from 'antd'
import {
  AppstoreOutlined,
  CameraOutlined,
  LinkOutlined,
  ApiOutlined,
  BookOutlined,
  ThunderboltOutlined,
  SafetyCertificateOutlined,
  EyeOutlined,
  AlertOutlined,
  HistoryOutlined,
  DashboardOutlined,
  DollarOutlined,
  BarChartOutlined,
  CloudOutlined,
  HomeOutlined,
  NodeIndexOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  BulbOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useLicenseStore } from '../stores/licenseStore'
import { useCapabilityStore } from '../stores/capabilityStore'
import { useUserStore } from '../stores/userStore'
import { isCameraSupported } from '../services/mcp-client'

const { Sider, Header, Content } = Layout
const { Text } = Typography

const cameraSupported = isCameraSupported()

const platformKeyMap: Record<string, string> = {
  '/platform/tuya': 'tuya',
  '/platform/midea': 'midea',
  '/platform/ewelink': 'ewelink',
  '/platform/xiaomi': 'xiaomi',
}

function buildMenuItems(isPlatformEnabled: (p: string) => boolean) {
  const platformChildren = [
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
        disabled: true,
        label: (
          <Tooltip title="升级授权版解锁此平台" placement="right">
            <span>{typeof item.label === 'string' ? item.label : item.label}</span>
          </Tooltip>
        ),
      }
    }
    return item
  })

  return [
    {
      type: 'group' as const,
      label: '概览',
      children: [
        { key: '/', icon: <DashboardOutlined />, label: '数据看板' },
      ],
    },
    {
      type: 'group' as const,
      label: '平台集成',
      children: platformChildren,
    },
    {
      type: 'group' as const,
      label: '设备管理',
      children: [
        { key: '/devices', icon: <AppstoreOutlined />, label: '设备列表' },
        {
          key: '/cameras',
          icon: <CameraOutlined />,
          label: cameraSupported
            ? '摄像头'
            : (
                <Tooltip title="Windows 平台暂不支持" placement="right">
                  <span style={{ color: 'rgba(0,0,0,0.25)' }}>摄像头</span>
                </Tooltip>
              ),
        },
      ],
    },
    {
      type: 'group' as const,
      label: 'AI 与自动化',
      children: [
        { key: '/memory', icon: <FileTextOutlined />, label: '记忆' },
        { key: '/skills', icon: <BulbOutlined />, label: '技能' },
        { key: '/schedules', icon: <ClockCircleOutlined />, label: '定时任务' },
        { key: '/vision', icon: <EyeOutlined />, label: 'Vision AI' },
        { key: '/triggers', icon: <AlertOutlined />, label: '触发规则' },
        { key: '/trigger-logs', icon: <HistoryOutlined />, label: '触发日志' },
      ],
    },
    {
      type: 'group' as const,
      label: '统计与系统',
      children: [
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

export default function AppLayout({ children }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const serverOnline = useAuthStore((s) => s.serverOnline)
  const checkServer = useAuthStore((s) => s.checkServer)
  const licenseEdition = useLicenseStore((s) => s.edition)
  const fetchLicense = useLicenseStore((s) => s.fetchStatus)
  const capPlatforms = useCapabilityStore((s) => s.platforms)
  const fetchCapabilities = useCapabilityStore((s) => s.fetchCapabilities)
  const wechatUser = useUserStore((s) => s.user)
  const wechatLoggedIn = useUserStore((s) => s.isLoggedIn)
  const restoreSession = useUserStore((s) => s.restoreSession)
  const { token } = theme.useToken()
  const timerRef = useRef<ReturnType<typeof setInterval>>()

  const menuItems = React.useMemo(
    () => buildMenuItems((p: string) => capPlatforms[p] !== false),
    [capPlatforms]
  )

  useEffect(() => { restoreSession() }, [restoreSession])

  useEffect(() => {
    checkServer()
    fetchCapabilities()
    timerRef.current = setInterval(checkServer, 2000)
    const unsub = useAuthStore.subscribe((s, prev) => {
      if (s.serverOnline && !prev.serverOnline) {
        clearInterval(timerRef.current)
        timerRef.current = setInterval(checkServer, 15000)
        fetchLicense()
        fetchCapabilities()
      } else if (!s.serverOnline && prev.serverOnline) {
        clearInterval(timerRef.current)
        timerRef.current = setInterval(checkServer, 2000)
      }
    })
    return () => { clearInterval(timerRef.current); unsub() }
  }, [checkServer, fetchLicense, fetchCapabilities])

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        width={200}
        style={{ background: token.colorBgContainer }}
        breakpoint="lg"
        collapsedWidth={60}
      >
        <div
          style={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <Space>
            <ApiOutlined style={{ fontSize: 20, color: token.colorPrimary }} />
            <Text strong style={{ fontSize: 15 }}>FeyaGate</Text>
          </Space>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0, marginTop: 4, fontSize: 13 }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: token.colorBgContainer,
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            height: 56,
          }}
        >
          <Text strong style={{ fontSize: 16 }}>FeyaGate Desktop</Text>
          <Space>
            {/* WeChat login hidden - uncomment when web app ID is configured
            {wechatLoggedIn && wechatUser && (
              <Text
                style={{ cursor: 'pointer', fontSize: 13 }}
                onClick={() => navigate('/wechat')}
              >
                <WechatOutlined style={{ color: '#07c160', marginRight: 4 }} />
                {wechatUser.nickname}
              </Text>
            )} */}
            {serverOnline && (
              <Badge
                status={licenseEdition === 'licensed' ? 'success' : 'warning'}
                text={
                  <Text
                    type={licenseEdition === 'licensed' ? undefined : 'warning'}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate('/license')}
                  >
                    {licenseEdition === 'licensed' ? '授权版' : '免费版'}
                  </Text>
                }
              />
            )}
            <Badge
              status={serverOnline ? 'success' : 'error'}
              text={
                <Text type={serverOnline ? undefined : 'danger'}>
                  MCP Server {serverOnline ? '在线' : '离线'}
                </Text>
              }
            />
            <LinkOutlined
              style={{ cursor: 'pointer', color: token.colorTextSecondary }}
              onClick={() => {
                const open = window.feyagate?.openExternal ?? ((u: string) => window.open(u, '_blank'))
                open('https://www.feyagate.com')
              }}
            />
          </Space>
        </Header>
        <Content style={{ margin: 16, overflow: 'auto' }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  )
}
