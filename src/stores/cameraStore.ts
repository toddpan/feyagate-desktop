import { create } from 'zustand'
import * as mcp from '../services/mcp-client'
import type { Camera, CameraStatusItem } from '../services/mcp-client'

interface CameraState {
  cameras: Camera[]
  statusMap: Record<string, CameraStatusItem>
  snapshots: Record<string, string[]>
  loading: boolean
  connecting: string | null
  error: string | null

  fetchCameras: () => Promise<void>
  fetchStatus: (cameraId?: string) => Promise<void>
  connect: (cameraId: string) => Promise<void>
  disconnect: (cameraId: string) => Promise<void>
  takeSnapshot: (cameraId: string, count?: number) => Promise<void>
  clearError: () => void
}

export const useCameraStore = create<CameraState>((set, get) => ({
  cameras: [],
  statusMap: {},
  snapshots: {},
  loading: false,
  connecting: null,
  error: null,

  fetchCameras: async () => {
    set({ loading: true, error: null })
    try {
      const result = await mcp.getCameraList()
      set({ cameras: result.cameras, loading: false })
    } catch (e) {
      set({ loading: false, error: String(e) })
    }
  },

  fetchStatus: async (cameraId?: string) => {
    try {
      const result = await mcp.getCameraStatus(cameraId)
      const map = { ...get().statusMap }
      for (const cam of result.cameras) {
        map[cam.did] = cam
      }
      set({ statusMap: map })
    } catch {
      // silent
    }
  },

  connect: async (cameraId: string) => {
    set({ connecting: cameraId, error: null })
    try {
      await mcp.connectCamera(cameraId)
      set({ connecting: null })
      await get().fetchStatus(cameraId)
    } catch (e) {
      set({ connecting: null, error: String(e) })
    }
  },

  disconnect: async (cameraId: string) => {
    set({ connecting: cameraId, error: null })
    try {
      await mcp.disconnectCamera(cameraId)
      set({ connecting: null })
      const map = { ...get().statusMap }
      delete map[cameraId]
      set({ statusMap: map })
    } catch (e) {
      set({ connecting: null, error: String(e) })
    }
  },

  takeSnapshot: async (cameraId: string, count = 1) => {
    set({ error: null })
    try {
      const { images } = await mcp.getCameraSnapshot(cameraId, count)
      set({
        snapshots: { ...get().snapshots, [cameraId]: images },
      })
    } catch (e) {
      set({ error: String(e) })
    }
  },

  clearError: () => set({ error: null }),
}))
