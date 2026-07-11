import React from 'react'
import { Result, Button } from 'antd'
import { LockOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useCapabilityStore } from '../stores/capabilityStore'

interface Props {
  platform: string
  children: React.ReactNode
}

const PLATFORM_LABEL: Record<string, string> = {
  xiaomi: '米家',
  tuya: '涂鸦',
  midea: '美的',
  ewelink: '易微联',
}

export default function PlatformGate({ platform, children }: Props) {
  const platforms = useCapabilityStore((s) => s.platforms)
  const details = useCapabilityStore((s) => s.platformDetails)
  const navigate = useNavigate()

  if (platforms[platform] === false) {
    const label = PLATFORM_LABEL[platform] || platform
    const msg = details[platform]?.message
    // 试用到期 vs 平台禁用 的提示区分
    const isTrialExpired =
      details[platform]?.trialHours && details[platform]?.trialHours > 0
    return (
      <Result
        icon={<LockOutlined />}
        title={isTrialExpired ? `${label}试用已到期` : '需要授权版'}
        subTitle={
          msg ||
          (isTrialExpired
            ? `${label}平台免费试用已结束，升级授权版可继续使用。`
            : '此平台功能仅限授权版使用，免费版仅支持米家平台。')
        }
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
