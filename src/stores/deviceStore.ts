import { create } from 'zustand'
import * as mcp from '../services/mcp-client'

export interface UnifiedDevice {
  id: string
  name: string
  model: string
  platform: string
  online: boolean
  category: string
  home_name: string
  room_name: string
}

interface DeviceState {
  devices: UnifiedDevice[]
  totalCount: number
  loading: boolean
  refreshing: boolean
  error: string | null
  searchKeyword: string
  platformFilter: string

  fetchDevices: () => Promise<void>
  refreshDevices: () => Promise<void>
  setSearchKeyword: (keyword: string) => void
  setPlatformFilter: (platform: string) => void
  filteredDevices: () => UnifiedDevice[]
}

export const useDeviceStore = create<DeviceState>((set, get) => ({
  devices: [],
  totalCount: 0,
  loading: false,
  refreshing: false,
  error: null,
  searchKeyword: '',
  platformFilter: '',

  fetchDevices: async () => {
    set({ loading: true, error: null })
    try {
      const result = await mcp.getAllDevices()
      set({
        devices: result.devices as UnifiedDevice[],
        totalCount: result.total,
        loading: false,
      })
    } catch (e) {
      set({ loading: false, error: String(e) })
    }
  },

  refreshDevices: async () => {
    set({ refreshing: true, error: null })
    try {
      await get().fetchDevices()
      set({ refreshing: false })
    } catch (e) {
      set({ refreshing: false, error: String(e) })
    }
  },

  setSearchKeyword: (keyword: string) => {
    set({ searchKeyword: keyword })
  },

  setPlatformFilter: (platform: string) => {
    set({ platformFilter: platform })
  },

  filteredDevices: () => {
    const { devices, searchKeyword, platformFilter } = get()
    let filtered = devices
    if (platformFilter) {
      filtered = filtered.filter((d) => d.platform === platformFilter)
    }
    if (!searchKeyword.trim()) return filtered
    const kw = searchKeyword.toLowerCase()
    return filtered.filter(
      (d) =>
        d.name.toLowerCase().includes(kw) ||
        d.model.toLowerCase().includes(kw) ||
        (d.room_name || '').toLowerCase().includes(kw) ||
        (d.home_name || '').toLowerCase().includes(kw) ||
        d.platform.toLowerCase().includes(kw)
    )
  },
}))
