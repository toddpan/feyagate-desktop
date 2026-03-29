import { create } from 'zustand'
import {
  WeChatUserInfo,
  loginWithCode,
  completeWithInviteCode,
  applyInviteCode,
  InviteRequiredData,
} from '../services/wechat-auth'

interface UserState {
  isLoggedIn: boolean
  loading: boolean
  error: string | null
  token: string | null
  user: WeChatUserInfo | null
  pendingInvite: InviteRequiredData | null

  login: (code: string) => Promise<void>
  completeInvite: (inviteCode: string) => Promise<void>
  applyInvite: (email: string, reason: string) => Promise<{ success: boolean; message: string }>
  logout: () => void
  restoreSession: () => void
  clearError: () => void
  clearPendingInvite: () => void
}

const STORAGE_KEY = 'feyagate_user'

function loadSession(): { token: string | null; user: WeChatUserInfo | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { token: null, user: null }
    const data = JSON.parse(raw)
    return { token: data.token || null, user: data.user || null }
  } catch {
    return { token: null, user: null }
  }
}

function saveSession(token: string, user: WeChatUserInfo) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user }))
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEY)
}

export const useUserStore = create<UserState>((set, get) => ({
  isLoggedIn: false,
  loading: false,
  error: null,
  token: null,
  user: null,
  pendingInvite: null,

  login: async (code: string) => {
    set({ loading: true, error: null })
    try {
      const result = await loginWithCode(code)
      if (result.type === 'success') {
        saveSession(result.data.token, result.data.user)
        set({
          isLoggedIn: true,
          token: result.data.token,
          user: result.data.user,
          pendingInvite: null,
          loading: false,
        })
      } else if (result.type === 'invite_required') {
        set({ pendingInvite: result.data, loading: false })
      } else {
        set({ error: result.message, loading: false })
      }
    } catch (e) {
      set({ error: `网络请求失败: ${e instanceof Error ? e.message : String(e)}`, loading: false })
    }
  },

  completeInvite: async (inviteCode: string) => {
    const { pendingInvite } = get()
    if (!pendingInvite) {
      set({ error: '缺少待注册信息' })
      return
    }
    set({ loading: true, error: null })
    try {
      const result = await completeWithInviteCode(
        pendingInvite.open_id,
        pendingInvite.nickname,
        pendingInvite.avatar,
        inviteCode,
      )
      if (result.type === 'success') {
        saveSession(result.data.token, result.data.user)
        set({
          isLoggedIn: true,
          token: result.data.token,
          user: result.data.user,
          pendingInvite: null,
          loading: false,
        })
      } else {
        set({ error: result.message, loading: false })
      }
    } catch (e) {
      set({ error: `网络请求失败: ${e instanceof Error ? e.message : String(e)}`, loading: false })
    }
  },

  applyInvite: async (email: string, reason: string) => {
    set({ loading: true, error: null })
    try {
      const result = await applyInviteCode(email, reason)
      set({ loading: false })
      return result
    } catch (e) {
      set({ loading: false })
      return { success: false, message: `网络请求失败: ${e instanceof Error ? e.message : String(e)}` }
    }
  },

  logout: () => {
    clearSession()
    set({
      isLoggedIn: false,
      token: null,
      user: null,
      pendingInvite: null,
      error: null,
    })
  },

  restoreSession: () => {
    const { token, user } = loadSession()
    if (token && user) {
      set({ isLoggedIn: true, token, user })
    }
  },

  clearError: () => set({ error: null }),
  clearPendingInvite: () => set({ pendingInvite: null }),
}))
