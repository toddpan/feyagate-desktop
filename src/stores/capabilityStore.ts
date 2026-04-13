import { create } from 'zustand'
import * as mcp from '../services/mcp-client'

interface CapabilityState {
  platforms: Record<string, boolean>
  loading: boolean
  fetchCapabilities: () => Promise<void>
}

export const useCapabilityStore = create<CapabilityState>((set) => ({
  platforms: { xiaomi: true, tuya: true, midea: true, ewelink: true },
  loading: false,

  fetchCapabilities: async () => {
    set({ loading: true })
    try {
      const info = await mcp.getLicenseStatus()
      const licensed = info.edition === 'licensed'
      set({
        platforms: {
          xiaomi: true,
          tuya: licensed,
          midea: licensed,
          ewelink: licensed,
        },
        loading: false,
      })
    } catch {
      set({ loading: false })
    }
  },
}))
