/**
 * WeChat login service for FeyaGate Desktop.
 *
 * Mirrors the Android WeChatLoginManager flow:
 * 1. Get WeChat OAuth code (via QR scan in Electron BrowserWindow)
 * 2. POST /api/v1/wechat/login  {code, type:"web"}
 * 3. If 4011 → invite required; user enters invite code
 * 4. POST /api/v1/wechat/complete  {open_id, nickname, avatar, invite_code}
 * 5. POST /api/v1/invite/apply  {email, reason}
 *
 * All requests carry HMAC signature headers identical to the Android app.
 */

const USER_API_BASE = 'https://www.feyagate.com'
const USER_APP_ID = 'feyagate-web-app'
const USER_APP_SECRET = 'b3f8a2d9c7e1f4b6a0d3e5f7c9b2a4d6e8f0b1c3d5a7e9f2b4c6d8a0e2f4b6c8'

const WECHAT_WEB_APP_ID = 'wxbf7f2dd2817552b1'
const WECHAT_REDIRECT_URI = `${USER_API_BASE}/auth/wechat/callback`
export const WECHAT_CALLBACK_HOST = 'www.feyagate.com'

// ── Crypto helpers ─────────────────────────────────────────────

function hexStringToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function hmacSha256(hexKey: string, data: string): Promise<string> {
  const keyBytes = hexStringToBytes(hexKey)
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function buildSignatureHeaders(
  method: string,
  fullUrl: string,
  body: string,
): Promise<Record<string, string>> {
  const path = new URL(fullUrl).pathname
  const timestamp = Math.floor(Date.now() / 1000)
  const bodyHash =
    method === 'POST' || method === 'PUT' ? await sha256Hex(body || '') : ''
  const signData = `${method}\n${path}\n${timestamp}\n${bodyHash}`
  const signature = await hmacSha256(USER_APP_SECRET, signData)
  return {
    'X-HA-App-Id': USER_APP_ID,
    'X-HA-Timestamp': String(timestamp),
    'X-HA-Signature': signature,
  }
}

async function signedPost<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const bodyStr = JSON.stringify(body)
  const sigHeaders = await buildSignatureHeaders('POST', url, bodyStr)
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...sigHeaders },
    body: bodyStr,
  })
  return resp.json() as Promise<T>
}

// ── Types ──────────────────────────────────────────────────────

export interface WeChatUserInfo {
  open_id: string
  nickname: string
  avatar: string
  union_id?: string
}

export interface LoginSuccessData {
  token: string
  user: WeChatUserInfo
}

export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data?: T
}

export interface InviteRequiredData {
  open_id: string
  nickname: string
  avatar: string
}

// ── Public API ─────────────────────────────────────────────────

export function buildWeChatQRUrl(state: string = 'feyagate_desktop'): string {
  const params = new URLSearchParams({
    appid: WECHAT_WEB_APP_ID,
    redirect_uri: WECHAT_REDIRECT_URI,
    response_type: 'code',
    scope: 'snsapi_login',
    state,
  })
  return `https://open.weixin.qq.com/connect/qrconnect?${params}#wechat_redirect`
}

/**
 * Exchange WeChat auth code for user token.
 * Same as Android WeChatLoginManager.loginWithCode().
 */
export async function loginWithCode(
  code: string,
): Promise<
  | { type: 'success'; data: LoginSuccessData }
  | { type: 'invite_required'; data: InviteRequiredData }
  | { type: 'error'; message: string }
> {
  const url = `${USER_API_BASE}/api/v1/wechat/login`
  const resp = await signedPost<ApiResponse<LoginSuccessData & InviteRequiredData>>(url, {
    code,
    type: 'web',
  })

  if (resp.code === 4011 && resp.data) {
    return {
      type: 'invite_required',
      data: {
        open_id: resp.data.open_id,
        nickname: resp.data.nickname,
        avatar: resp.data.avatar,
      },
    }
  }

  if (resp.code === 4012) {
    return { type: 'error', message: '邀请码无效或已过期' }
  }

  if (resp.code !== 0 || !resp.data) {
    return { type: 'error', message: resp.message || '登录失败' }
  }

  return { type: 'success', data: resp.data as LoginSuccessData }
}

/**
 * Complete registration with invite code.
 * Same as Android WeChatLoginManager.completeWithInviteCode().
 */
export async function completeWithInviteCode(
  openId: string,
  nickname: string,
  avatar: string,
  inviteCode: string,
): Promise<{ type: 'success'; data: LoginSuccessData } | { type: 'error'; message: string }> {
  const url = `${USER_API_BASE}/api/v1/wechat/complete`
  const resp = await signedPost<ApiResponse<LoginSuccessData>>(url, {
    open_id: openId,
    nickname: nickname,
    avatar: avatar,
    invite_code: inviteCode,
  })

  if (resp.code === 4012) {
    return { type: 'error', message: '邀请码无效或已过期' }
  }

  if (resp.code !== 0 || !resp.data) {
    return { type: 'error', message: resp.message || '注册失败' }
  }

  return { type: 'success', data: resp.data }
}

/**
 * Apply for an invitation code.
 * Same as Android WeChatLoginManager.applyInviteCode().
 */
export async function applyInviteCode(
  email: string,
  reason: string,
): Promise<{ success: boolean; message: string }> {
  const url = `${USER_API_BASE}/api/v1/invite/apply`
  const resp = await signedPost<ApiResponse>(url, { email, reason })
  return {
    success: resp.code === 0,
    message: resp.message || (resp.code === 0 ? '申请已提交' : '申请失败'),
  }
}
