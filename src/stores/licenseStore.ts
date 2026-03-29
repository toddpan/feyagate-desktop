import { create } from 'zustand'
import * as mcp from '../services/mcp-client'

interface LicenseState {
  edition: string
  status: string
  product: string
  keyMasked: string
  deviceId: string
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
        loading: false,
      })
    } catch (e) {
      set({ loading: false, error: String(e) })
    }
  },
}))
