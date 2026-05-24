import { create } from 'zustand'
import * as mcp from '../services/mcp-client'

interface AuthState {
  authorized: boolean
  cloudServer: string
  remainingSeconds: number
  loading: boolean
  error: string | null
  serverOnline: boolean
  selectedRegion: string

  fetchStatus: () => Promise<void>
  startOAuth: (region?: string) => Promise<void>
  handleCallback: (code: string, region?: string) => Promise<void>
  checkServer: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  authorized: false,
  cloudServer: '',
  remainingSeconds: 0,
  loading: false,
  error: null,
  serverOnline: false,
  selectedRegion: 'cn',

  checkServer: async () => {
    try {
      const online = await mcp.healthCheck()
      set({ serverOnline: online })
      if (online && !get().authorized) {
        get().fetchStatus()
      }
    } catch {
      set({ serverOnline: false })
    }
  },

  fetchStatus: async () => {
    set({ loading: true, error: null })
    try {
      const status = await mcp.getAuthStatus()
      set({
        authorized: status.authorized,
        cloudServer: status.cloud_server,
        remainingSeconds: status.remaining_seconds,
        loading: false,
      })
    } catch (e) {
      set({ loading: false, error: String(e) })
    }
  },

  startOAuth: async (region?: string) => {
    set({ loading: true, error: null })
    try {
      const r = region || get().selectedRegion || 'cn'
      const url = await mcp.getAuthUrl(r)
      await mcp.openOAuth(url)
      set({ loading: false })
    } catch (e) {
      set({ loading: false, error: String(e) })
    }
  },

  handleCallback: async (code: string, region?: string) => {
    set({ loading: true, error: null })
    try {
      const r = region || get().selectedRegion || 'cn'
      await mcp.authCallback(code, r)
      await get().fetchStatus()
    } catch (e) {
      set({ loading: false, error: String(e) })
    }
  },
}))

if (window.feyagate?.onServerReady) {
  window.feyagate.onServerReady(() => {
    console.log('[Auth] MCP server ready event received')
    useAuthStore.getState().checkServer()
  })
}
