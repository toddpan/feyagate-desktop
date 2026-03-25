// Browser fallback when running outside Electron (e.g. `vite dev` in browser)
// In browser dev mode, use same-origin proxy; in Electron, use direct URL
let _serverUrl = window.feyagate ? 'http://localhost:8080' : ''
let _authCodeCallbacks: Array<(code: string) => void> = []

async function browserMcpCall(method: string, params?: Record<string, unknown>) {
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: Date.now(),
    method,
    params: params ?? {},
  })
  const resp = await fetch(`${_serverUrl}/mcp/http`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
  const json = await resp.json()
  if (json.error) throw new Error(json.error.message || JSON.stringify(json.error))
  return json.result
}

async function browserCallTool(name: string, args?: Record<string, unknown>) {
  return browserMcpCall('tools/call', { name, arguments: args ?? {} })
}

const browserFallback = {
  mcpCall: browserMcpCall,
  callTool: browserCallTool,
  openOAuth: async (url: string) => { window.open(url, '_blank') },
  onAuthCode: (cb: (code: string) => void) => { _authCodeCallbacks.push(cb) },
  getServerUrl: async () => _serverUrl,
  setServerUrl: async (url: string) => { _serverUrl = url.replace(/\/+$/, '') },
  healthCheck: async () => {
    try {
      const resp = await fetch(`${_serverUrl}/health`, { signal: AbortSignal.timeout(3000) })
      const json = await resp.json()
      return json.status === 'ok'
    } catch { return false }
  },
  openExternal: async (url: string) => { window.open(url, '_blank') },
}

const api = window.feyagate ?? browserFallback

// Allow browser-based OAuth callback via URL hash (e.g. #code=xxx)
if (!window.feyagate) {
  const hash = window.location.hash
  const codeMatch = hash.match(/[?&]code=([^&]+)/)
  if (codeMatch) {
    setTimeout(() => _authCodeCallbacks.forEach((cb) => cb(codeMatch[1])), 100)
  }
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface AuthStatus {
  authorized: boolean
  cloud_server: string
  remaining_seconds: number
}

export interface AuthUrl {
  url: string
}

export interface AuthCallback {
  success: boolean
}

export interface Device {
  did: string
  name: string
  model: string
  home: string
  room: string
  online: boolean
}

export interface DeviceListResult {
  count: number
  devices: Device[]
}

export interface Camera {
  did: string
  name: string
  model: string
  home: string
  room: string
  online: boolean
  channel_count: number
  camera_status: string
}

export interface CameraListResult {
  count: number
  cameras: Camera[]
}

export interface CameraStatusItem {
  did: string
  status: string
  buffered_frames: number
  channel: number
}

export interface CameraStatusResult {
  connected_count: number
  cameras: CameraStatusItem[]
}

export interface SnapshotFrame {
  data: string
  timestamp: number
  channel: number
}

export interface SnapshotResult {
  camera_id: string
  frames: SnapshotFrame[]
}

export interface RefreshResult {
  success: boolean
  device_count: number
  camera_count: number
}

// ── Helper ──────────────────────────────────────────────────────────────────

interface ToolResponse {
  content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>
}

function parseToolText<T>(result: ToolResponse): T {
  const textItem = result.content?.find((c) => c.type === 'text')
  if (!textItem?.text) throw new Error('No text content in tool response')
  return JSON.parse(textItem.text) as T
}

function parseToolImage(result: ToolResponse): string[] {
  return result.content
    ?.filter((c) => c.type === 'image' && c.data)
    .map((c) => `data:${c.mimeType || 'image/jpeg'};base64,${c.data}`) ?? []
}

async function callTool<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const result = (await api.callTool(name, args)) as ToolResponse
  return parseToolText<T>(result)
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function initialize() {
  return api.mcpCall('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'feyagate-desktop', version: '1.0' },
  })
}

export async function healthCheck(): Promise<boolean> {
  return api.healthCheck()
}

export async function getServerUrl(): Promise<string> {
  return api.getServerUrl()
}

export async function setServerUrl(url: string): Promise<void> {
  return api.setServerUrl(url)
}

// Auth
export async function getAuthStatus(): Promise<AuthStatus> {
  return callTool<AuthStatus>('auth/status')
}

export async function getAuthUrl(): Promise<string> {
  const result = await callTool<AuthUrl>('auth/url')
  return result.url
}

export async function authCallback(code: string): Promise<AuthCallback> {
  return callTool<AuthCallback>('auth/callback', { code })
}

export function openOAuth(url: string) {
  return api.openOAuth(url)
}

export function onAuthCode(callback: (code: string) => void) {
  api.onAuthCode(callback)
}

// Devices
export async function getDeviceList(filter?: string[]): Promise<DeviceListResult> {
  const args: Record<string, unknown> = {}
  if (filter?.length) args.filter = filter
  return callTool<DeviceListResult>('device/list', args)
}

export async function refreshDevices(): Promise<RefreshResult> {
  return callTool<RefreshResult>('device/refresh')
}

// Cameras
export async function getCameraList(filter?: string[]): Promise<CameraListResult> {
  const args: Record<string, unknown> = {}
  if (filter?.length) args.filter = filter
  return callTool<CameraListResult>('camera/list', args)
}

export async function getCameraStatus(cameraId?: string): Promise<CameraStatusResult> {
  const args: Record<string, unknown> = {}
  if (cameraId) args.camera_id = cameraId
  return callTool<CameraStatusResult>('camera/status', args)
}

export async function connectCamera(cameraId: string) {
  return callTool('camera/connect', { camera_id: cameraId })
}

export async function disconnectCamera(cameraId: string) {
  return callTool('camera/disconnect', { camera_id: cameraId })
}

export async function getCameraSnapshot(
  cameraId: string,
  count = 1,
  channel = 0
): Promise<{ images: string[]; raw: ToolResponse }> {
  const result = (await api.callTool('camera/snapshot', {
    camera_id: cameraId,
    count,
    channel,
  })) as ToolResponse

  const images = parseToolImage(result)

  // Fallback: some servers embed base64 in text content as data URLs
  if (images.length === 0) {
    const textItem = result.content?.find((c) => c.type === 'text' && c.text?.startsWith('data:'))
    if (textItem?.text) {
      images.push(textItem.text)
    }
  }

  return { images, raw: result }
}
