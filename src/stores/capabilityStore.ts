import { create } from 'zustand'
import { getLicenseStatus } from '../services/mcp-client'

interface PlatformState {
  enabled: boolean
  trialHours: number
  trialRemainingHours: number
  message: string
}

interface CapabilityState {
  // 各平台是否可用（已结合服务端配置与试用到期解析）
  platforms: Record<string, boolean>
  platformDetails: Record<string, PlatformState>
  features: Record<string, boolean>
  edition: string
  message: string
  loading: boolean
  fetchCapabilities: () => Promise<void>
  /** 某平台是否可用（平台未列出时默认可用） */
  canUse: (platform: string) => boolean
}

const ALL_PLATFORMS = ['xiaomi', 'tuya', 'midea', 'ewelink']

export const useCapabilityStore = create<CapabilityState>((set, get) => ({
  // 默认全开放，真实状态由 fetchCapabilities 从服务端拉取后覆盖
  platforms: { xiaomi: true, tuya: true, midea: true, ewelink: true },
  platformDetails: {},
  features: {},
  edition: 'free',
  message: '',
  loading: false,

  fetchCapabilities: async () => {
    set({ loading: true })
    try {
      const info = await getLicenseStatus()
      const caps = info?.capabilities
      if (caps && caps.platforms) {
        const platforms: Record<string, boolean> = {}
        const details: Record<string, PlatformState> = {}
        // 保证所有已知平台都有键，未列出默认可用
        for (const p of ALL_PLATFORMS) {
          const policy = caps.platforms[p]
          const enabled = policy ? policy.enabled : true
          platforms[p] = enabled
          if (policy) {
            details[p] = {
              enabled: policy.enabled,
              trialHours: policy.trial_hours ?? 0,
              trialRemainingHours: policy.trial_remaining_hours ?? 0,
              message: policy.message ?? '',
            }
          }
        }
        set({
          platforms,
          platformDetails: details,
          features: caps.features ?? {},
          edition: caps.edition ?? info.edition,
          message: caps.message ?? '',
          loading: false,
        })
        return
      }
    } catch {
      // 拉取失败时保留默认（全开放），实际拦截在 MCP 工具层兜底
    }
    set({ loading: false })
  },

  canUse: (platform: string) => {
    const platforms = get().platforms
    return platform in platforms ? platforms[platform] : true
  },
}))
