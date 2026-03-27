import React, { useEffect, useRef } from 'react'
import { Layout, Menu, Badge, Typography, Space, theme } from 'antd'
import {
  LoginOutlined,
  AppstoreOutlined,
  CameraOutlined,
  ControlOutlined,
  LinkOutlined,
  ApiOutlined,
  BookOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

const { Sider, Header, Content } = Layout
const { Text } = Typography

const menuItems = [
  { key: '/', icon: <LoginOutlined />, label: '授权登录' },
  { key: '/devices', icon: <AppstoreOutlined />, label: '设备列表' },
  { key: '/control', icon: <ControlOutlined />, label: '设备控制' },
  { key: '/cameras', icon: <CameraOutlined />, label: '摄像头' },
  { key: '/docs', icon: <BookOutlined />, label: '接口文档' },
]

interface Props {
  children: React.ReactNode
}

export default function AppLayout({ children }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const serverOnline = useAuthStore((s) => s.serverOnline)
  const checkServer = useAuthStore((s) => s.checkServer)
  const { token } = theme.useToken()
  const timerRef = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => {
    checkServer()
    timerRef.current = setInterval(checkServer, 2000)
    const unsub = useAuthStore.subscribe((s, prev) => {
      if (s.serverOnline && !prev.serverOnline) {
        clearInterval(timerRef.current)
        timerRef.current = setInterval(checkServer, 15000)
      } else if (!s.serverOnline && prev.serverOnline) {
        clearInterval(timerRef.current)
        timerRef.current = setInterval(checkServer, 2000)
      }
    })
    return () => { clearInterval(timerRef.current); unsub() }
  }, [checkServer])

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
          style={{ borderRight: 0, marginTop: 4 }}
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
