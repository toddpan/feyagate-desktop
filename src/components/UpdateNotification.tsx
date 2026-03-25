import { useEffect } from 'react'
import { Modal, Button, Space, Typography, Tag, Alert } from 'antd'
import {
  CloudDownloadOutlined,
  RocketOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useUpdateStore } from '../stores/updateStore'
import { openDownloadUrl } from '../services/updater'

const { Text, Paragraph, Title } = Typography

export default function UpdateNotification() {
  const {
    hasUpdate,
    updateInfo,
    currentVersion,
    dismissed,
    check,
    dismiss,
  } = useUpdateStore()

  useEffect(() => {
    check()
  }, [check])

  if (!hasUpdate || !updateInfo || dismissed) return null

  const isForced = updateInfo.force_update

  return (
    <Modal
      open
      title={
        <Space>
          <RocketOutlined style={{ color: '#1677ff' }} />
          <span>发现新版本</span>
          {isForced && <Tag color="red">强制更新</Tag>}
        </Space>
      }
      footer={
        <Space>
          {!isForced && (
            <Button onClick={dismiss}>稍后再说</Button>
          )}
          <Button
            type="primary"
            icon={<CloudDownloadOutlined />}
            onClick={() => {
              openDownloadUrl(updateInfo.url)
              if (!isForced) dismiss()
            }}
          >
            立即下载 v{updateInfo.version}
          </Button>
        </Space>
      }
      closable={!isForced}
      maskClosable={!isForced}
      onCancel={isForced ? undefined : dismiss}
      width={480}
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Space>
          <Tag color="default">当前: v{currentVersion}</Tag>
          <Text type="secondary">→</Text>
          <Tag color="blue">新版: v{updateInfo.version}</Tag>
        </Space>

        {isForced && (
          <Alert
            type="warning"
            icon={<WarningOutlined />}
            message="此版本为强制更新，请立即升级以继续使用"
            showIcon
          />
        )}

        <div>
          <Title level={5} style={{ marginBottom: 8 }}>更新内容</Title>
          <Paragraph
            style={{
              background: '#f5f5f5',
              padding: '12px 16px',
              borderRadius: 8,
              whiteSpace: 'pre-wrap',
              maxHeight: 200,
              overflow: 'auto',
            }}
          >
            {updateInfo.release_notes || '性能优化和 Bug 修复'}
          </Paragraph>
        </div>

        {updateInfo.size && (
          <Text type="secondary">
            文件大小: {(updateInfo.size / 1024 / 1024).toFixed(1)} MB
          </Text>
        )}
      </Space>
    </Modal>
  )
}
