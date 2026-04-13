import React from 'react'
import { Result, Button } from 'antd'
import { LockOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useCapabilityStore } from '../stores/capabilityStore'

interface Props {
  platform: string
  children: React.ReactNode
}

export default function PlatformGate({ platform, children }: Props) {
  const platforms = useCapabilityStore((s) => s.platforms)
  const navigate = useNavigate()

  if (platforms[platform] === false) {
    return (
      <Result
        icon={<LockOutlined />}
        title="需要授权版"
        subTitle="此平台功能仅限授权版使用，免费版仅支持米家平台。"
        extra={
          <Button type="primary" onClick={() => navigate('/license')}>
            查看授权
          </Button>
        }
      />
    )
  }

  return <>{children}</>
}
