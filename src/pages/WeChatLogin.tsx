import { useEffect, useState, useCallback } from 'react'
import {
  Card,
  Button,
  Space,
  Typography,
  Input,
  Alert,
  Divider,
  Avatar,
  Spin,
  Modal,
  Form,
  Result,
  Tag,
  Descriptions,
  message,
} from 'antd'
import {
  WechatOutlined,
  UserOutlined,
  MailOutlined,
  KeyOutlined,
  LogoutOutlined,
  QrcodeOutlined,
  FormOutlined,
} from '@ant-design/icons'
import { useUserStore } from '../stores/userStore'
import { buildWeChatQRUrl, WECHAT_CALLBACK_HOST } from '../services/wechat-auth'

const { Text, Title, Paragraph } = Typography
const { TextArea } = Input

export default function WeChatLogin() {
  const {
    isLoggedIn,
    loading,
    error,
    user,
    pendingInvite,
    login,
    completeInvite,
    applyInvite,
    logout,
    restoreSession,
    clearError,
    clearPendingInvite,
  } = useUserStore()

  const [inviteCode, setInviteCode] = useState('')
  const [applyVisible, setApplyVisible] = useState(false)
  const [waitingForScan, setWaitingForScan] = useState(false)
  const [applyForm] = Form.useForm()
  const [messageApi, contextHolder] = message.useMessage()

  useEffect(() => {
    restoreSession()
  }, [restoreSession])

  const handleCodeReceived = useCallback(async (code: string) => {
    setWaitingForScan(false)
    messageApi.info('已收到授权码，正在登录...')
    await login(code)
  }, [login, messageApi])

  useEffect(() => {
    if (window.feyagate?.onWeChatCode) {
      window.feyagate.onWeChatCode(handleCodeReceived)
    }
  }, [handleCodeReceived])

  const handleWeChatLogin = () => {
    const state = `desktop_${Date.now()}`
    const qrUrl = buildWeChatQRUrl(state)

    if (window.feyagate?.openWeChatOAuth) {
      window.feyagate.openWeChatOAuth(qrUrl, WECHAT_CALLBACK_HOST)
      setWaitingForScan(true)
      messageApi.info('请在弹出窗口中使用微信扫码')
    } else {
      window.open(qrUrl, '_blank', 'width=520,height=640')
      messageApi.info('已打开微信扫码登录页面，请在浏览器中完成扫码')
    }
  }

  const handleManualCodeLogin = () => {
    Modal.confirm({
      title: '手动输入授权码',
      content: (
        <Input
          id="manual-code-input"
          placeholder="请输入微信授权 code"
          style={{ marginTop: 12 }}
        />
      ),
      okText: '登录',
      cancelText: '取消',
      onOk: async () => {
        const input = document.getElementById('manual-code-input') as HTMLInputElement
        const code = input?.value?.trim()
        if (code) {
          await login(code)
        }
      },
    })
  }

  const handleInviteSubmit = async () => {
    if (!inviteCode.trim()) {
      messageApi.warning('请输入邀请码')
      return
    }
    await completeInvite(inviteCode.trim())
  }

  const handleApplySubmit = async () => {
    try {
      const values = await applyForm.validateFields()
      const result = await applyInvite(values.email, values.reason || '')
      if (result.success) {
        messageApi.success(result.message)
        setApplyVisible(false)
        applyForm.resetFields()
      } else {
        messageApi.error(result.message)
      }
    } catch {
      // validation failed
    }
  }

  const handleLogout = () => {
    Modal.confirm({
      title: '确认退出登录',
      content: '退出后需要重新扫码登录微信账号',
      okText: '确认退出',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => logout(),
    })
  }

  if (isLoggedIn && user) {
    return (
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {contextHolder}
        <Card>
          <Space direction="vertical" align="center" style={{ width: '100%' }}>
            <Avatar
              size={80}
              src={user.avatar}
              icon={<UserOutlined />}
              style={{ marginBottom: 8 }}
            />
            <Title level={4} style={{ margin: 0 }}>
              {user.nickname || '微信用户'}
            </Title>
            <Tag color="green" icon={<WechatOutlined />}>
              已登录
            </Tag>
          </Space>

          <Divider />

          <Descriptions column={1} size="small">
            <Descriptions.Item label="昵称">{user.nickname}</Descriptions.Item>
            <Descriptions.Item label="OpenID">
              <Text code copyable style={{ fontSize: 12 }}>
                {user.open_id}
              </Text>
            </Descriptions.Item>
            {user.union_id && (
              <Descriptions.Item label="UnionID">
                <Text code style={{ fontSize: 12 }}>
                  {user.union_id}
                </Text>
              </Descriptions.Item>
            )}
          </Descriptions>

          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <Button danger icon={<LogoutOutlined />} onClick={handleLogout}>
              退出登录
            </Button>
          </div>
        </Card>
      </Space>
    )
  }

  if (pendingInvite) {
    return (
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {contextHolder}
        {error && (
          <Alert message={error} type="error" showIcon closable onClose={clearError} />
        )}

        <Card>
          <Result
            icon={<KeyOutlined style={{ color: '#faad14' }} />}
            title="需要邀请码"
            subTitle={
              <>
                欢迎 <Text strong>{pendingInvite.nickname}</Text>
                ，您是新用户，需要输入邀请码完成注册。
              </>
            }
          />

          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div>
              <Text strong>
                <KeyOutlined /> 输入邀请码
              </Text>
              <Input
                placeholder="请输入邀请码"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                style={{ marginTop: 8 }}
                size="large"
                prefix={<KeyOutlined />}
                onPressEnter={handleInviteSubmit}
              />
            </div>

            <Space>
              <Button
                type="primary"
                icon={<KeyOutlined />}
                onClick={handleInviteSubmit}
                loading={loading}
                disabled={!inviteCode.trim()}
              >
                验证邀请码
              </Button>
              <Button onClick={() => setApplyVisible(true)} icon={<MailOutlined />}>
                申请邀请码
              </Button>
              <Button
                onClick={() => {
                  clearPendingInvite()
                  clearError()
                }}
              >
                返回
              </Button>
            </Space>
          </Space>
        </Card>

        <Modal
          title={
            <Space>
              <FormOutlined /> 申请邀请码
            </Space>
          }
          open={applyVisible}
          onOk={handleApplySubmit}
          onCancel={() => setApplyVisible(false)}
          okText="提交申请"
          cancelText="取消"
          confirmLoading={loading}
        >
          <Paragraph type="secondary">
            提交申请后，邀请码将通过邮箱发送给您。
          </Paragraph>
          <Form form={applyForm} layout="vertical">
            <Form.Item
              name="email"
              label="邮箱地址"
              rules={[
                { required: true, message: '请输入邮箱' },
                { type: 'email', message: '请输入有效的邮箱地址' },
              ]}
            >
              <Input prefix={<MailOutlined />} placeholder="your@email.com" />
            </Form.Item>
            <Form.Item name="reason" label="申请理由 (可选)">
              <TextArea rows={3} placeholder="简述您的使用场景..." />
            </Form.Item>
          </Form>
        </Modal>
      </Space>
    )
  }

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      {contextHolder}
      {error && (
        <Alert message={error} type="error" showIcon closable onClose={clearError} />
      )}

      <Card>
        <Spin spinning={loading || waitingForScan} tip={waitingForScan ? '等待微信扫码...' : undefined}>
          <Space direction="vertical" align="center" style={{ width: '100%' }}>
            <QrcodeOutlined style={{ fontSize: 64, color: '#07c160' }} />
            <Title level={3} style={{ margin: '8px 0 4px' }}>
              微信登录
            </Title>
            <Paragraph type="secondary" style={{ textAlign: 'center', maxWidth: 400 }}>
              使用微信扫码登录 FeyaGate 用户中心，管理您的设备和 VIP 权益。
            </Paragraph>

            <Space direction="vertical" size="middle" style={{ marginTop: 12 }}>
              <Button
                type="primary"
                size="large"
                icon={<WechatOutlined />}
                onClick={handleWeChatLogin}
                disabled={waitingForScan}
                style={{ background: '#07c160', borderColor: '#07c160', width: 260 }}
              >
                {waitingForScan ? '等待扫码中...' : '微信扫码登录'}
              </Button>
              <Button
                type="link"
                size="small"
                icon={<KeyOutlined />}
                onClick={handleManualCodeLogin}
              >
                手动输入授权码
              </Button>
            </Space>
          </Space>
        </Spin>
      </Card>

      <Card size="small" title="登录说明">
        <Descriptions column={1} size="small">
          <Descriptions.Item label="步骤 1">
            点击「微信扫码登录」，在弹出窗口中用微信扫描二维码
          </Descriptions.Item>
          <Descriptions.Item label="步骤 2">
            在微信中确认授权登录
          </Descriptions.Item>
          <Descriptions.Item label="步骤 3">
            新用户需要输入邀请码完成注册
          </Descriptions.Item>
          <Descriptions.Item label="步骤 4">
            登录成功后即可使用全部功能
          </Descriptions.Item>
        </Descriptions>
        <Divider style={{ margin: '12px 0' }} />
        <Text type="secondary">
          没有邀请码？注册时可以申请，邀请码将通过邮件发送。
        </Text>
      </Card>
    </Space>
  )
}
