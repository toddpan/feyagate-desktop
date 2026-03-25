import { create } from 'zustand'
import * as mcp from '../services/mcp-client'
import type { Device } from '../services/mcp-client'

interface DeviceState {
  devices: Device[]
  totalCount: number
  loading: boolean
  refreshing: boolean
  error: string | null
  searchKeyword: string

  fetchDevices: (filter?: string[]) => Promise<void>
  refreshDevices: () => Promise<void>
  setSearchKeyword: (keyword: string) => void
  filteredDevices: () => Device[]
}

export const useDeviceStore = create<DeviceState>((set, get) => ({
  devices: [],
  totalCount: 0,
  loading: false,
  refreshing: false,
  error: null,
  searchKeyword: '',

  fetchDevices: async (filter?: string[]) => {
    set({ loading: true, error: null })
    try {
      const result = await mcp.getDeviceList(filter)
      set({
        devices: result.devices,
        totalCount: result.count,
        loading: false,
      })
    } catch (e) {
      set({ loading: false, error: String(e) })
    }
  },

  refreshDevices: async () => {
    set({ refreshing: true, error: null })
    try {
      await mcp.refreshDevices()
      await get().fetchDevices()
      set({ refreshing: false })
    } catch (e) {
      set({ refreshing: false, error: String(e) })
    }
  },

  setSearchKeyword: (keyword: string) => {
    set({ searchKeyword: keyword })
  },

  filteredDevices: () => {
    const { devices, searchKeyword } = get()
    if (!searchKeyword.trim()) return devices
    const kw = searchKeyword.toLowerCase()
    return devices.filter(
      (d) =>
        d.name.toLowerCase().includes(kw) ||
        d.model.toLowerCase().includes(kw) ||
        d.room.toLowerCase().includes(kw) ||
        d.home.toLowerCase().includes(kw)
    )
  },
}))
