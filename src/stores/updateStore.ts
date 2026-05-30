import { create } from 'zustand'
import { checkForUpdate, type UpdateInfo } from '../services/updater'

interface UpdateState {
  hasUpdate: boolean
  updateInfo: UpdateInfo | null
  currentVersion: string
  checking: boolean
  error: string | null
  dismissed: boolean

  check: () => Promise<void>
  dismiss: () => void
}

export const useUpdateStore = create<UpdateState>((set) => ({
  hasUpdate: false,
  updateInfo: null,
  currentVersion: '1.2.16',
  checking: false,
  error: null,
  dismissed: false,

  check: async () => {
    set({ checking: true, error: null })
    try {
      const result = await checkForUpdate()
      set({
        hasUpdate: result.hasUpdate,
        updateInfo: result.updateInfo,
        currentVersion: result.currentVersion,
        checking: false,
      })
    } catch (e) {
      set({ checking: false, error: String(e) })
    }
  },

  dismiss: () => set({ dismissed: true }),
}))
