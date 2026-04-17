import { create } from 'zustand'

interface CapabilityState {
  platforms: Record<string, boolean>
  loading: boolean
  fetchCapabilities: () => Promise<void>
}

export const useCapabilityStore = create<CapabilityState>((set) => ({
  platforms: { xiaomi: true, tuya: true, midea: true, ewelink: true },
  loading: false,

  fetchCapabilities: async () => {
    // 所有平台菜单均开放，授权限制仅在设备控制层（MCP 工具 handler）执行
    set({
      platforms: { xiaomi: true, tuya: true, midea: true, ewelink: true },
      loading: false,
    })
  },
}))
