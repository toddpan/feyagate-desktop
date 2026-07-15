import { create } from 'zustand'
import { getPlatforms, PlatformInfo } from '../services/mcp-client'

interface PlatformAuthState {
  platforms: PlatformInfo[]
  loading: boolean
  error: string | null
  fetchedAt: number
  fetchPlatforms: () => Promise<void>
  isPlatformAuthenticated: (id: string) => boolean
}

const FETCH_INTERVAL_MS = 15000

export const usePlatformAuthStore = create<PlatformAuthState>((set, get) => ({
  platforms: [],
  loading: false,
  error: null,
  fetchedAt: 0,

  fetchPlatforms: async () => {
    set({ loading: true, error: null })
    try {
      const data = await getPlatforms()
      const list = Array.isArray(data) ? data : []
      set({ platforms: list, loading: false, fetchedAt: Date.now() })
    } catch (e) {
      set({ loading: false, error: String(e) })
    }
  },

  isPlatformAuthenticated: (id: string) => {
    return get().platforms.some((p) => p.platform_id === id && p.authenticated)
  },
}))

export function startPlatformAuthPolling(intervalMs = FETCH_INTERVAL_MS): () => void {
  const tick = () => { usePlatformAuthStore.getState().fetchPlatforms() }
  tick()
  const handle = setInterval(tick, intervalMs)
  return () => clearInterval(handle)
}
