import React from 'react'
import { Result, Button } from 'antd'
import { LockOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useCapabilityStore } from '../stores/capabilityStore'
import { platformLabel, joinPlatformLabels, groupPlatformsByPolicy } from '../utils/platformStatus'

interface Props {
  platform: string
  children: React.ReactNode
}

export default function PlatformGate({ platform, children }: Props) {
  const platforms = useCapabilityStore((s) => s.platforms)
  const details = useCapabilityStore((s) => s.platformDetails)
  const loaded = useCapabilityStore((s) => s.loaded)
  const navigate = useNavigate()

  if (platforms[platform] === false) {
    const label = platformLabel(platform)
    const msg = details[platform]?.message
    const status = details[platform]?.status
    // 依据服务端下发的 status 区分：试用到期 / 订阅过期 / 需授权版
    const title =
      status === 'trial_expired'
        ? `${label}试用已到期`
        : status === 'subscription_expired'
          ? `${label}订阅已过期`
          : '需要授权版'
    // 免费平台清单来自服务端下发的策略，端侧不写死
    const freeNames = joinPlatformLabels(groupPlatformsByPolicy(details).free)
    const fallbackSub =
      status === 'trial_expired'
        ? `${label}平台免费试用已结束，升级授权版可继续使用。`
        : status === 'subscription_expired'
          ? `${label}平台订阅已过期，请续费后继续使用。`
          : !loaded
            ? '正在从服务器同步授权规则…'
            : freeNames
              ? `此平台功能需授权版解锁，免费版当前可用平台：${freeNames}。`
              : '此平台功能需授权版解锁。'
    return (
      <Result
        icon={<LockOutlined />}
        title={title}
        subTitle={msg || fallbackSub}
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
