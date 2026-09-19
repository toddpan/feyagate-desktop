import { useEffect, useState, useCallback } from 'react'
import {
  Card, Button, Tag, Empty,
  Table, message, Popconfirm, Input, Form, Modal,
  Space, Row, Col, Alert,
} from 'antd'
import {
  CloudOutlined, ReloadOutlined, LogoutOutlined,
  CheckCircleFilled, CloseCircleFilled, UserOutlined, LockOutlined,
  SafetyCertificateOutlined, MobileOutlined, ClockCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'
import {
  getPlatforms, PlatformInfo,
  huaweiLogin, huaweiChallenge, huaweiLogout,
  getHuaweiDevices, refreshHuaweiDevices, HuaweiDevice,
} from '../services/mcp-client'
import { useAuthStore } from '../stores/authStore'
import { Hero, PageHeader, SoftTag, StatTile } from '../components/ui'

export default function HuaweiAuth() {
  const serverOnline = useAuthStore((s) => s.serverOnline)
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [loginLoading, setLoginLoading] = useState(false)
  const [challengeLoading, setChallengeLoading] = useState(false)

  // Challenge modal state
  const [challengeVisible, setChallengeVisible] = useState(false)
  const [challengeTarget, setChallengeTarget] = useState('')

  const [devices, setDevices] = useState<HuaweiDevice[]>([])
  const [devLoading, setDevLoading] = useState(false)

  const [messageApi, contextHolder] = message.useMessage()
  const [form] = Form.useForm()
  const [challengeForm] = Form.useForm()

  const huaweiPlatform = platforms.find((p) => p.platform_id === 'huawei')
  const isAuthed = huaweiPlatform?.authenticated ?? false
  const authStatus = huaweiPlatform?.auth_status as Record<string, unknown> | undefined

  const fetchPlatforms = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getPlatforms()
      const list = Array.isArray(data) ? data : []
      setPlatforms(list)
      const hw = list.find((p) => p.platform_id === 'huawei')
      const st = hw?.auth_status as Record<string, unknown> | undefined
      if (st?.pending_challenge) {
        setChallengeTarget((st.challenge_name as string) || '')
        setChallengeVisible(true)
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  const fetchDevices = useCallback(async () => {
    try {
      setDevLoading(true)
      const data = await getHuaweiDevices()
      setDevices(data.devices || [])
    } catch { /* ignore */ }
    finally { setDevLoading(false) }
  }, [])

  useEffect(() => {
    if (serverOnline) fetchPlatforms()
  }, [serverOnline, fetchPlatforms])

  useEffect(() => {
    if (isAuthed) {
      fetchDevices()
      setChallengeVisible(false)
    }
  }, [isAuthed, fetchDevices])

  const handleLogin = async (values: { account: string; password: string }) => {
    try {
      setLoginLoading(true)
      const result = await huaweiLogin(values.account, values.password)
      const st = result.auth_status as Record<string, unknown> | undefined
      if (result.success) {
        messageApi.success(`登录成功，共 ${result.device_count ?? 0} 台设备`)
        form.resetFields()
        setChallengeVisible(false)
        fetchPlatforms()
      } else if (st?.pending_challenge) {
        setChallengeTarget((st.challenge_name as string) || values.account)
        setChallengeVisible(true)
        messageApi.info('华为帐号需进行两步安全验证，请输入验证码')
        fetchPlatforms()
      } else {
        messageApi.error(result.message || '登录失败，请检查账号和密码')
      }
    } catch (e: unknown) {
      messageApi.error(e instanceof Error ? e.message : '请求失败')
    } finally {
      setLoginLoading(false)
    }
  }

  const handleCompleteChallenge = async (values: { code: string }) => {
    try {
      setChallengeLoading(true)
      const result = await huaweiChallenge(values.code.trim())
      if (result.success) {
        messageApi.success('双重安全验证通过，登录成功！')
        setChallengeVisible(false)
        challengeForm.resetFields()
        form.resetFields()
        fetchPlatforms()
      } else {
        messageApi.error(result.error || result.message || '验证码错误或已过期')
      }
    } catch (e: unknown) {
      messageApi.error(e instanceof Error ? e.message : '验证失败')
    } finally {
      setChallengeLoading(false)
    }
  }

  const handleLogout = async () => {
    await huaweiLogout()
    messageApi.info('已退出华为账号')
    setDevices([])
    setChallengeVisible(false)
    fetchPlatforms()
  }

  const handleRefresh = async () => {
    try {
      const res = await refreshHuaweiDevices()
      if (res.success) {
        messageApi.success(`已刷新，共 ${res.device_count} 台设备`)
        fetchDevices()
      } else {
        messageApi.error('刷新失败')
      }
    } catch {
      messageApi.error('刷新请求失败')
    }
  }

  const deviceColumns = [
    {
      title: '设备名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, r: HuaweiDevice) => (
        <Space direction="vertical" size={2}>
          <span style={{ fontWeight: 600 }}>{text}</span>
          <span style={{ fontSize: 12, color: 'var(--fg-text-tertiary)' }}>ID: {r.id}</span>
        </Space>
      ),
    },
    {
      title: '品类 / 类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => <Tag color="blue">{type || '未知'}</Tag>,
    },
    {
      title: '所属房间',
      dataIndex: 'room_name',
      key: 'room_name',
      render: (room?: string) => room ? <SoftTag tone="info">{room}</SoftTag> : <span style={{ color: 'var(--fg-text-quaternary)' }}>未分配</span>,
    },
    {
      title: '状态',
      dataIndex: 'online',
      key: 'online',
      render: (online: boolean) =>
        online ? (
          <SoftTag tone="success">
            <CheckCircleFilled style={{ marginRight: 4 }} /> 在线
          </SoftTag>
        ) : (
          <SoftTag tone="default">
            <CloseCircleFilled style={{ marginRight: 4 }} /> 离线
          </SoftTag>
        ),
    },
  ]

  return (
    <div style={{ padding: '0 4px', maxWidth: 1200, margin: '0 auto' }}>
      {contextHolder}
      <div style={{ marginBottom: 20 }}>
        <Hero
          icon={<CloudOutlined />}
          title={isAuthed ? '已连接华为智慧生活' : '未登录华为账号'}
          description={
            isAuthed
              ? `用户 ID: ${(authStatus?.user_id as string) || '--'} · ${devices.length} 台设备`
              : '通过华为智慧生活开放接口接入，支持小智 AI 语音控制与 MCP 跨平台调度'
          }
          actions={
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => { fetchPlatforms(); if (isAuthed) fetchDevices() }}
                loading={loading || devLoading}
              >
                刷新
              </Button>
              {isAuthed && (
                <Popconfirm title="确定要退出华为账号吗？" onConfirm={handleLogout} okText="退出" cancelText="取消">
                  <Button danger icon={<LogoutOutlined />}>退出登录</Button>
                </Popconfirm>
              )}
            </Space>
          }
        />
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} md={8}>
          <StatTile
            label="账号状态"
            value={isAuthed ? '已登录' : '未登录'}
            tone={isAuthed ? 'success' : 'default'}
            icon={isAuthed ? <CheckCircleFilled /> : <CloseCircleFilled />}
            trend={isAuthed ? ((authStatus?.account as string) || '已连接') : '请输入华为账号登录'}
          />
        </Col>
        <Col xs={24} sm={12} md={8}>
          <StatTile
            label="已同步设备"
            value={devices.length}
            tone={devices.length > 0 ? 'info' : 'default'}
            icon={<CloudOutlined />}
            suffix="台"
            trend={isAuthed ? '支持小智 AI 及 MCP 控制' : '登录后自动同步'}
          />
        </Col>
        <Col xs={24} sm={12} md={8}>
          <StatTile
            label="安全通道"
            value={isAuthed ? 'HMS-Lite + MQTT' : '待连接'}
            tone={isAuthed ? 'info' : 'default'}
            icon={<ClockCircleOutlined />}
            trend={isAuthed ? `用户 ID: ${(authStatus?.user_id as string) || '--'}` : 'RSA-OAEP 256 安全加密'}
          />
        </Col>
      </Row>

      {/* 登录卡片 */}
      {!isAuthed && (
        <Card
          title={
            <Space>
              <UserOutlined />
              <span>华为智慧生活账号登录</span>
            </Space>
          }
          style={{ marginBottom: 20 }}
        >
          <Row gutter={24} align="middle">
            <Col xs={24} md={12}>
              <Alert
                message="关于华为账号登录安全"
                description="使用华为账号密码登录后，系统会自动获取 RSA 公钥并完成 OAEP SHA-256 加密。若华为安全策略触发两步验证（挑战码），请在手机或华为设备弹窗中查看 6 位验证码并在弹窗中提交。"
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />
              <Form form={form} layout="vertical" onFinish={handleLogin}>
                <Form.Item
                  label="华为账号"
                  name="account"
                  rules={[{ required: true, message: '请输入华为账号（手机号或邮箱）' }]}
                >
                  <Input prefix={<MobileOutlined />} placeholder="如: 186xxxxxxxx 或 邮箱" size="large" />
                </Form.Item>
                <Form.Item
                  label="账号密码"
                  name="password"
                  rules={[{ required: true, message: '请输入华为账号密码' }]}
                >
                  <Input.Password prefix={<LockOutlined />} placeholder="华为账号密码" size="large" />
                </Form.Item>
                <Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={loginLoading}
                    block
                    size="large"
                    icon={<SafetyCertificateOutlined />}
                  >
                    登录并同步设备
                  </Button>
                </Form.Item>
              </Form>
            </Col>
            <Col xs={24} md={12} style={{ borderLeft: '1px solid var(--fg-border)', paddingLeft: 24 }}>
              <div style={{ color: 'var(--fg-text-secondary)', lineHeight: 1.8 }}>
                <h4 style={{ color: 'var(--fg-text)', marginBottom: 8 }}>接入流程说明：</h4>
                <ol style={{ paddingLeft: 20 }}>
                  <li>输入华为智慧生活 App 对应的华为账号与密码；</li>
                  <li>网关自动通过华为账号安全通道（IDM loginV3）建立连接；</li>
                  <li>若提示两步验证挑战，请在华为手机/平板屏幕弹窗查看 6 位验证码并填入；</li>
                  <li>认证通过后将自动拉取名下所有智能家居设备，并自动对接到小智语音助手与 MCP 接口。</li>
                </ol>
              </div>
            </Col>
          </Row>
        </Card>
      )}

      {/* 设备列表 */}
      {isAuthed && (
        <Card
          title={
            <PageHeader
              icon={<CloudOutlined />}
              title={`已连接设备 (${devices.length})`}
              subtitle="已同步至网关的华为智慧生活设备，支持小智 AI 大模型控制与状态读取"
            />
          }
          extra={
            <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={devLoading}>
              重新从华为云同步
            </Button>
          }
        >
          {devices.length > 0 ? (
            <Table
              dataSource={devices}
              columns={deviceColumns}
              rowKey="id"
              pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 台设备` }}
              loading={devLoading}
            />
          ) : (
            <Empty
              description="华为账号下暂无设备，或设备尚未被分配在家庭中"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Button type="primary" onClick={handleRefresh} loading={devLoading}>
                重新同步
              </Button>
            </Empty>
          )}
        </Card>
      )}

      {/* 2FA 挑战验证码弹窗 */}
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#faad14' }} />
            <span>华为安全验证（设备挑战码）</span>
          </Space>
        }
        open={challengeVisible}
        onCancel={() => setChallengeVisible(false)}
        footer={null}
        destroyOnClose
      >
        <div style={{ marginBottom: 16 }}>
          <Alert
            message="安全验证提示"
            description={`华为服务器已向您的华为设备/手机 (${challengeTarget || '已绑定设备'}) 发送了 6 位安全挑战码。请在华为手机/平板屏幕弹窗或智慧生活 App 中查看，并输入下方验证框。`}
            type="warning"
            showIcon
          />
        </div>
        <Form form={challengeForm} layout="vertical" onFinish={handleCompleteChallenge}>
          <Form.Item
            label="6 位安全验证码"
            name="code"
            rules={[{ required: true, message: '请输入收到的 6 位验证码' }]}
          >
            <Input
              prefix={<SafetyCertificateOutlined />}
              placeholder="如: 123456"
              size="large"
              maxLength={8}
              autoFocus
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setChallengeVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={challengeLoading}>
                提交验证
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
