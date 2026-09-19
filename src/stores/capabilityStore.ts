import { create } from 'zustand'
import { getLicenseStatus } from '../services/mcp-client'

interface PlatformState {
  enabled: boolean
  trialHours: number
  trialRemainingHours: number
  message: string
  status: string // licensed/free/trial_active/trial_expired/subscription_expired
  trialRemainingDays: number
}

interface CapabilityState {
  // 各平台是否可用（已结合服务端配置与试用到期解析）
  // 未同步时为空对象：平台"未知"一律按放行处理（见 canUse），但 UI 不得据此断言免费/试用规则
  platforms: Record<string, boolean>
  platformDetails: Record<string, PlatformState>
  features: Record<string, boolean>
  edition: string
  message: string
  /** 是否已从云端拉到授权规则（false = 未同步，UI 应显示中性态而非断言平台可用性） */
  loaded: boolean
  /** 订阅是否有效（含宽限期） */
  isSubscriptionActive: boolean
  /** 宽限期剩余天数，0=不在宽限期 */
  gracePeriodRemaining: number
  /** ISO8601 订阅到期时间 */
  subscriptionExpiresAt: string
  loading: boolean
  fetchCapabilities: () => Promise<void>
  /** 某平台是否可用（平台未列出时默认可用） */
  canUse: (platform: string) => boolean
}

export const useCapabilityStore = create<CapabilityState>((set, get) => ({
  // 默认不假装知道任何平台的收费规则，真实状态由 fetchCapabilities 从服务端拉取后覆盖
  platforms: {},
  platformDetails: {},
  features: {},
  edition: 'free',
  message: '',
  loaded: false,
  isSubscriptionActive: false,
  gracePeriodRemaining: 0,
  subscriptionExpiresAt: '',
  loading: false,

  fetchCapabilities: async () => {
    set({ loading: true })
    try {
      const info = await getLicenseStatus()
      const caps = info?.capabilities
      if (caps && caps.platforms) {
        // 平台清单完全来自服务端下发，端侧不再维护写死的平台列表
        const platforms: Record<string, boolean> = {}
        const details: Record<string, PlatformState> = {}
        for (const [p, policy] of Object.entries(caps.platforms)) {
          platforms[p] = policy.enabled
          details[p] = {
            enabled: policy.enabled,
            trialHours: policy.trial_hours ?? 0,
            trialRemainingHours: policy.trial_remaining_hours ?? 0,
            message: policy.message ?? '',
            status: policy.status ?? '',
            trialRemainingDays: policy.trial_remaining_days ?? 0,
          }
        }
        // 兼容未返回 loaded 的旧服务端：有平台明细即视为已同步
        const loaded = caps.loaded ?? Object.keys(details).length > 0
        set({
          platforms,
          platformDetails: details,
          features: caps.features ?? {},
          edition: caps.edition ?? info.edition,
          message: caps.message ?? '',
          loaded,
          // v2 文档 §3.4：订阅到期/宽限期副文案来源
          isSubscriptionActive: caps.is_subscription_active ?? false,
          gracePeriodRemaining: caps.grace_period_remaining ?? 0,
          subscriptionExpiresAt: caps.subscription_expires_at ?? '',
          loading: false,
        })
        return
      }
    } catch {
      // 拉取失败时保持"未同步"（platforms 为空），实际拦截在 MCP 工具层兜底
    }
    set({ loading: false })
  },

  canUse: (platform: string) => {
    const platforms = get().platforms
    return platform in platforms ? platforms[platform] : true
  },
}))
