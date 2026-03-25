import { create } from 'zustand'
import * as mcp from '../services/mcp-client'

interface AuthState {
  authorized: boolean
  cloudServer: string
  remainingSeconds: number
  loading: boolean
  error: string | null
  serverOnline: boolean

  fetchStatus: () => Promise<void>
  startOAuth: () => Promise<void>
  handleCallback: (code: string) => Promise<void>
  checkServer: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  authorized: false,
  cloudServer: '',
  remainingSeconds: 0,
  loading: false,
  error: null,
  serverOnline: false,

  checkServer: async () => {
    const online = await mcp.healthCheck()
    set({ serverOnline: online })
    if (online && !get().authorized) {
      get().fetchStatus()
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

  startOAuth: async () => {
    set({ loading: true, error: null })
    try {
      const url = await mcp.getAuthUrl()
      await mcp.openOAuth(url)
      set({ loading: false })
    } catch (e) {
      set({ loading: false, error: String(e) })
    }
  },

  handleCallback: async (code: string) => {
    set({ loading: true, error: null })
    try {
      await mcp.authCallback(code)
      await get().fetchStatus()
    } catch (e) {
      set({ loading: false, error: String(e) })
    }
  },
}))
