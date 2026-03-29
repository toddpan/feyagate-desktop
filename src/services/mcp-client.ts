let _serverUrl = window.feyagate ? 'http://localhost:38080' : ''
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
  camera_id?: string
  status: string
  buffered_frames: number
  channel?: number
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
  try {
    return await api.healthCheck()
  } catch {
    return false
  }
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

export function onAuthSuccess(callback: () => void) {
  if (window.feyagate?.onAuthSuccess) {
    window.feyagate.onAuthSuccess(callback)
  }
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
  const raw = await callTool<Record<string, unknown>>('camera/status', args)

  if (Array.isArray(raw.cameras)) {
    const cameras = (raw.cameras as CameraStatusItem[]).map((c) => ({
      ...c,
      did: c.did || c.camera_id || '',
    }))
    return { connected_count: raw.connected_count as number, cameras }
  }

  const item: CameraStatusItem = {
    did: (raw.camera_id as string) || '',
    status: raw.status as string,
    buffered_frames: (raw.buffered_frames as number) || 0,
  }
  return { connected_count: item.status === 'connected' ? 1 : 0, cameras: [item] }
}

export async function connectCamera(cameraId: string) {
  return callTool('camera/connect', { camera_id: cameraId })
}

export async function disconnectCamera(cameraId: string) {
  return callTool('camera/disconnect', { camera_id: cameraId })
}

// Xiaomi device control
export interface XiaomiArea {
  area_id: string
  name: string
  device_count: number
}

export interface XiaomiDeviceClass {
  device_class: string
  count: number
}

export interface XiaomiDevice {
  did: string
  name: string
  online: boolean
  home_info: string
  device_class: string
  model: string
}

export interface SpecProperty {
  iid: string
  piid: number
  name: string
  format: string
  access: string
  valueRange?: unknown[]
}

export interface SpecAction {
  iid: string
  aiid: number
  name: string
  in: unknown[]
}

export interface SpecService {
  siid: number
  description: string
  properties: SpecProperty[]
  actions: SpecAction[]
}

export interface DeviceSpec {
  specType: string
  description: string
  services: SpecService[]
}

export async function getXiaomiAreas(): Promise<{ areas: XiaomiArea[]; total_areas: number }> {
  return callTool('xiaomi/get_area_info')
}

export async function getXiaomiDeviceClasses(): Promise<{ device_classes: XiaomiDeviceClass[]; total_classes: number }> {
  return callTool('xiaomi/get_device_classes')
}

export async function getXiaomiDevices(areaId?: string, deviceClass?: string): Promise<{ devices: XiaomiDevice[]; count: number }> {
  const args: Record<string, unknown> = {}
  if (areaId) args.area_id = areaId
  if (deviceClass) args.device_class = deviceClass
  return callTool('xiaomi/get_devices', args)
}

export async function getXiaomiDeviceSpec(deviceId: string): Promise<DeviceSpec> {
  return callTool('xiaomi/get_device_spec', { device_id: deviceId })
}

export async function xiaomiSendCtrlRpc(deviceId: string, iid: string, value?: unknown): Promise<Record<string, unknown>> {
  const args: Record<string, unknown> = { device_id: deviceId, iid }
  if (value !== undefined) args.value = value
  return callTool('xiaomi/send_ctrl_rpc', args)
}

export async function xiaomiSendGetRpc(deviceId: string, iid: string): Promise<Record<string, unknown>> {
  return callTool('xiaomi/send_get_rpc', { device_id: deviceId, iid })
}

export async function xiaomiSceneList(): Promise<Record<string, unknown>> {
  return callTool('xiaomi/scene_list')
}

export async function xiaomiSceneTrigger(sceneId: string): Promise<Record<string, unknown>> {
  return callTool('xiaomi/scene_trigger', { sceneId })
}

export interface XiaozhiStatus {
  state: string
  endpoint: string
  connected: boolean
  initialized: boolean
  bridged_tools: number
  enabled: boolean
}

export async function getXiaozhiStatus(): Promise<XiaozhiStatus> {
  return callTool('xiaozhi/status', {}) as Promise<XiaozhiStatus>
}

export interface XiaozhiSetEndpointResult {
  success: boolean
  endpoint: string
  config_saved: boolean
  state: string
}

export async function xiaozhiSetEndpoint(endpoint: string): Promise<XiaozhiSetEndpointResult> {
  return callTool('xiaozhi/set_endpoint', { endpoint }) as Promise<XiaozhiSetEndpointResult>
}

export async function xiaoaiTts(deviceId: string, text: string): Promise<Record<string, unknown>> {
  return callTool('xiaoai/tts', { device_id: deviceId, text })
}

export async function xiaoaiPlayMusic(deviceId: string, text: string): Promise<Record<string, unknown>> {
  return callTool('xiaoai/play_music', { device_id: deviceId, text })
}

export async function xiaoaiControl(deviceId: string, command: string, silence = true): Promise<Record<string, unknown>> {
  return callTool('xiaoai/control', { device_id: deviceId, command, silence })
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

  if (images.length === 0) {
    const textItem = result.content?.find((c) => c.type === 'text' && c.text)
    if (textItem?.text) {
      try {
        const parsed = JSON.parse(textItem.text)
        if (Array.isArray(parsed.images)) {
          for (const img of parsed.images) {
            if (typeof img.data_url === 'string' && img.data_url.startsWith('data:')) {
              images.push(img.data_url)
            }
          }
        }
      } catch {
        if (textItem.text.startsWith('data:')) {
          images.push(textItem.text)
        }
      }
    }
  }

  return { images, raw: result }
}
