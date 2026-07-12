import { create } from 'zustand'
import * as mcp from '../services/mcp-client'

interface LicenseState {
  edition: string
  status: string
  product: string
  keyMasked: string
  deviceId: string
  /** 订阅到期时间 ISO8601（仅 licensed + 订阅型生效） */
  subscriptionExpiresAt: string
  /** 宽限期剩余天数，0=不在宽限期 */
  gracePeriodRemaining: number
  /** 宽限期结束时间 ISO8601 */
  gracePeriodExpiresAt: string
  loading: boolean
  error: string | null

  fetchStatus: () => Promise<void>
  setLicenseKey: (key: string, product?: string) => Promise<boolean>
  clearLicense: () => Promise<void>
}

export const useLicenseStore = create<LicenseState>((set) => ({
  edition: 'free',
  status: 'free',
  product: '',
  keyMasked: '',
  deviceId: '',
  subscriptionExpiresAt: '',
  gracePeriodRemaining: 0,
  gracePeriodExpiresAt: '',
  loading: false,
  error: null,

  fetchStatus: async () => {
    set({ loading: true, error: null })
    try {
      const info = await mcp.getLicenseStatus()
      set({
        edition: info.edition,
        status: info.status,
        product: info.product,
        keyMasked: info.key_masked,
        deviceId: info.device_id,
        subscriptionExpiresAt: info.capabilities?.subscription_expires_at ?? '',
        gracePeriodRemaining: info.capabilities?.grace_period_remaining ?? 0,
        gracePeriodExpiresAt: info.capabilities?.grace_period_expires_at ?? '',
        loading: false,
      })
    } catch (e) {
      set({ loading: false, error: String(e) })
    }
  },

  setLicenseKey: async (key: string, product?: string) => {
    set({ loading: true, error: null })
    try {
      const info = await mcp.setLicenseKey(key, product)
      set({
        edition: info.edition,
        status: info.status,
        product: info.product,
        keyMasked: info.key_masked,
        deviceId: info.device_id,
        subscriptionExpiresAt: info.capabilities?.subscription_expires_at ?? '',
        gracePeriodRemaining: info.capabilities?.grace_period_remaining ?? 0,
        gracePeriodExpiresAt: info.capabilities?.grace_period_expires_at ?? '',
        loading: false,
      })
      return info.edition === 'licensed'
    } catch (e) {
      set({ loading: false, error: String(e) })
      return false
    }
  },

  clearLicense: async () => {
    set({ loading: true, error: null })
    try {
      const info = await mcp.clearLicense()
      set({
        edition: info.edition,
        status: info.status,
        product: info.product,
        keyMasked: info.key_masked,
        deviceId: info.device_id,
        subscriptionExpiresAt: '',
        gracePeriodRemaining: 0,
        gracePeriodExpiresAt: '',
        loading: false,
      })
    } catch (e) {
      set({ loading: false, error: String(e) })
    }
  },
}))
