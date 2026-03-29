import { useEffect, useState, useCallback } from 'react'
import {
  Card, Typography, Badge, Descriptions, Button, Space, Spin, Tag, Alert,
  Divider, Input, Form, message, Modal, Result,
} from 'antd'
import {
  SyncOutlined, CheckCircleOutlined, CloseCircleOutlined,
  SafetyCertificateOutlined, KeyOutlined, CopyOutlined,
  ExclamationCircleOutlined, DeleteOutlined, InfoCircleOutlined,
} from '@ant-design/icons'
import { useLicenseStore } from '../stores/licenseStore'

const { Title, Text, Paragraph } = Typography

export default function LicenseSettings() {
  const {
    edition, status, product, keyMasked, deviceId,
    loading, error, fetchStatus, setLicenseKey, clearLicense,
  } = useLicenseStore()

  const [keyInput, setKeyInput] = useState('')
  const [productInput, setProductInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [messageApi, contextHolder] = message.useMessage()

  const doFetch = useCallback(() => { fetchStatus() }, [fetchStatus])

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

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {contextHolder}

      <Space align="center" style={{ marginBottom: 16 }}>
        <SafetyCertificateOutlined style={{ fontSize: 24 }} />
        <Title level={3} style={{ margin: 0 }}>设备授权</Title>
      </Space>

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

      {/* Status Card */}
      <Card
        title={
          <Space>
            <SafetyCertificateOutlined />
            <span>授权状态</span>
            <Badge status={isLicensed ? 'success' : 'warning'} />
          </Space>
        }
        extra={
          <Button
            icon={<SyncOutlined spin={loading} />}
            onClick={doFetch}
            loading={loading}
          >
            刷新
          </Button>
        }
      >
        {loading && !edition ? (
          <Spin tip="加载中..." />
        ) : (
          <>
            {isLicensed ? (
              <Result
                status="success"
                title="已授权"
                subTitle={product ? `产品: ${product}` : '全平台功能已解锁'}
                style={{ padding: '16px 0' }}
              />
            ) : (
              <Result
                status="warning"
                title="免费版"
                subTitle="仅支持米家平台，如需使用涂鸦/美的/易微联等平台，请输入授权码"
                style={{ padding: '16px 0' }}
              />
            )}
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="版本">
                {isLicensed ? (
                  <Tag icon={<CheckCircleOutlined />} color="success">授权版</Tag>
                ) : (
                  <Tag icon={<CloseCircleOutlined />} color="warning">免费版 (仅米家)</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={
                  status === 'activated' ? 'success' :
                  status === 'pending' ? 'processing' : 'default'
                }>
                  {status === 'activated' ? '已激活' :
                   status === 'pending' ? '待激活' : '未授权'}
                </Tag>
              </Descriptions.Item>
              {product && (
                <Descriptions.Item label="产品类型">
                  <Text>{product}</Text>
                </Descriptions.Item>
              )}
              {keyMasked && (
                <Descriptions.Item label="授权码">
                  <Text code>{keyMasked}</Text>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="设备 ID">
                <Text
                  copyable={{ text: deviceId, tooltips: ['复制设备ID', '已复制'] }}
                  code
                >
                  {deviceId}
                </Text>
              </Descriptions.Item>
            </Descriptions>

            {isLicensed && (
              <div style={{ marginTop: 12, textAlign: 'right' }}>
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
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    onClick={handleClear}
                  >
                    清除授权
                  </Button>
                </Space>
              </div>
            )}
          </>
        )}
      </Card>

      <Divider />

      {/* Input License Key */}
      <Card
        id="license-input-section"
        title={
          <Space>
            <KeyOutlined />
            <span>{isLicensed ? '更换授权码' : '输入授权码'}</span>
          </Space>
        }
      >
        <Paragraph type="secondary">
          请输入从代理商处获得的设备授权码，写入后设备将自动向云端激活。
        </Paragraph>
        <Form layout="vertical">
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
              style={{ fontFamily: 'monospace' }}
              prefix={<KeyOutlined />}
              allowClear
            />
          </Form.Item>
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
          <Form.Item>
            <Button
              type="primary"
              icon={<SafetyCertificateOutlined />}
              loading={saving}
              onClick={handleWriteKey}
            >
              写入授权码
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Divider />

      {/* Guide */}
      <Card
        title={
          <Space>
            <InfoCircleOutlined />
            <span>如何获取授权码</span>
          </Space>
        }
        size="small"
      >
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="步骤 1">
            联系代理商购买授权版虚拟网关
          </Descriptions.Item>
          <Descriptions.Item label="步骤 2">
            获取授权码 (格式: FG-XXXX-XXXX-XXXX)
          </Descriptions.Item>
          <Descriptions.Item label="步骤 3">
            在上方输入框中填写授权码并写入
          </Descriptions.Item>
          <Descriptions.Item label="步骤 4">
            系统自动向云端激活，激活后即可使用全平台功能
          </Descriptions.Item>
        </Descriptions>
        <Divider style={{ margin: '12px 0' }} />
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          <Text strong>免费版功能:</Text> 米家平台、设备控制、摄像头、小爱音箱、MCP代理、小智AI
        </Paragraph>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          <Text strong>授权版额外功能:</Text> 涂鸦平台、美的平台、易微联平台
        </Paragraph>
        <Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 8 }}>
          <CopyOutlined style={{ marginRight: 4 }} />
          提供设备 ID 给代理商时，可点击上方设备 ID 旁的复制按钮。
        </Paragraph>
      </Card>
    </div>
  )
}
