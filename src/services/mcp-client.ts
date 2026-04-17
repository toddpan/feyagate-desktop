let _serverUrl = window.feyagate ? 'http://localhost:38090' : ''
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
  return callTool<AuthStatus>('xiaomi/auth_status')
}

export async function getAuthUrl(): Promise<string> {
  const result = await callTool<AuthUrl>('xiaomi/auth_url')
  return result.url
}

export async function authCallback(code: string): Promise<AuthCallback> {
  return callTool<AuthCallback>('xiaomi/auth_callback', { code })
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
  return callTool<RefreshResult>('xiaomi/refresh')
}

// Cameras
export async function getCameraList(filter?: string[]): Promise<CameraListResult> {
  const args: Record<string, unknown> = {}
  if (filter?.length) args.filter = filter
  return callTool<CameraListResult>('xiaomi/camera_list', args)
}

export async function getCameraStatus(cameraId?: string): Promise<CameraStatusResult> {
  const args: Record<string, unknown> = {}
  if (cameraId) args.camera_id = cameraId
  const raw = await callTool<Record<string, unknown>>('xiaomi/camera_status', args)

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
  return callTool('xiaomi/camera_connect', { camera_id: cameraId })
}

export async function disconnectCamera(cameraId: string) {
  return callTool('xiaomi/camera_disconnect', { camera_id: cameraId })
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
  return callTool('device/specs', { device_id: deviceId })
}

export async function xiaomiSendCtrlRpc(deviceId: string, iid: string, value?: unknown): Promise<Record<string, unknown>> {
  // Parse siid and piid from iid format "prop.device.SIID.PIID"
  const parts = iid.split('.')
  const siid = parts.length >= 3 ? parts[2] : '0'
  const piid = parts.length >= 4 ? parts[3] : '0'
  return callTool('set_xiaomi_device_property', { deviceId, siid: Number(siid), piid: Number(piid), value })
}

export async function xiaomiSendGetRpc(deviceId: string, iid: string): Promise<Record<string, unknown>> {
  const parts = iid.split('.')
  const siid = parts.length >= 3 ? parts[2] : '0'
  const piid = parts.length >= 4 ? parts[3] : '0'
  return callTool('get_xiaomi_device_properties', { deviceId, siid: Number(siid), piids: [Number(piid)] })
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

// License (virtual gateway device authorization)
export interface LicenseInfo {
  edition: string       // "free" | "licensed"
  status: string        // "free" | "pending" | "activated"
  product: string       // e.g. "feyagate-linux"
  key_masked: string    // e.g. "FG-ABCD-****-IJKL"
  device_id: string     // 12-char hex device ID
  guidance?: {
    message: string
    how_to_authorize: string
    free_features: string
    licensed_features: string
  }
  activated?: boolean
  message?: string
}

export interface GatewayInfo {
  name: string
  version: string
  platform: string
  device_id: string
  license: {
    edition: string
    status: string
    product: string
    key_masked?: string
  }
}

export async function getLicenseStatus(): Promise<LicenseInfo> {
  return callTool<LicenseInfo>('license/status')
}

export async function setLicenseKey(licenseKey: string, product?: string): Promise<LicenseInfo> {
  const args: Record<string, unknown> = { license_key: licenseKey }
  if (product) args.product = product
  return callTool<LicenseInfo>('license/set', args)
}

export async function clearLicense(): Promise<LicenseInfo> {
  return callTool<LicenseInfo>('license/clear')
}

export async function getGatewayInfo(): Promise<GatewayInfo> {
  return callTool<GatewayInfo>('gateway/info')
}

// REST API alternatives (direct HTTP, for non-MCP clients)
export async function getLicenseStatusRest(): Promise<LicenseInfo> {
  const resp = await fetch(`${_serverUrl}/api/v1/gateway/license`)
  const json = await resp.json()
  return json.data as LicenseInfo
}

export async function setLicenseKeyRest(licenseKey: string, product?: string): Promise<LicenseInfo> {
  const body: Record<string, string> = { license_key: licenseKey }
  if (product) body.product = product
  const resp = await fetch(`${_serverUrl}/api/v1/gateway/license`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await resp.json()
  return json.data as LicenseInfo
}

export async function clearLicenseRest(): Promise<LicenseInfo> {
  const resp = await fetch(`${_serverUrl}/api/v1/gateway/license`, { method: 'DELETE' })
  const json = await resp.json()
  return json.data as LicenseInfo
}

export async function getCameraSnapshot(
  cameraId: string,
  count = 1,
  channel = 0
): Promise<{ images: string[]; raw: ToolResponse }> {
  const result = (await api.callTool('xiaomi/camera_snapshot', {
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

/**
 * Detect client platform. In Electron, uses process.platform exposed via preload.
 * In browser, falls back to navigator.userAgent detection.
 * Returns: 'win32' | 'darwin' | 'linux' | 'unknown'
 */
export function getClientPlatform(): string {
  if (window.feyagate?.platform) return window.feyagate.platform
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('win')) return 'win32'
  if (ua.includes('mac')) return 'darwin'
  if (ua.includes('linux')) return 'linux'
  return 'unknown'
}

export function isCameraSupported(): boolean {
  return getClientPlatform() !== 'win32'
}

// ── Stats ────────────────────────────────────────────────────────────────────

export interface TokenSummary {
  today_tokens: number
  today_calls: number
  month_tokens: number
  total_tokens: number
  total_calls: number
  total_failures: number
  estimated_total_cost: number
}

export interface DailyTokenStat {
  date: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  calls: number
  failures: number
  estimated_cost: number
}

export interface ModelTokenStat {
  model: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  calls: number
  estimated_cost: number
}

export interface SourceTokenStat {
  source: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  calls: number
}

export interface TokenUsageResult {
  summary: TokenSummary
  daily: DailyTokenStat[]
  by_model: ModelTokenStat[]
  by_source: SourceTokenStat[]
}

export interface TokenRecordItem {
  id: string
  timestamp: string
  source: string
  model: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  success: boolean
  rule_id: string
  camera_id: string
}

export interface TriggerDailyStat {
  date: string
  count: number
}

export interface TriggerRuleStat {
  rule_id: string
  rule_name: string
  count: number
}

export interface TriggerCameraStat {
  camera_id: string
  count: number
}

export interface TriggerHeatmapItem {
  weekday: string
  weekday_idx: number
  hour: number
  count: number
}

export interface TriggerSummaryResult {
  overview: {
    today: number
    this_week: number
    total: number
    enabled_rules: number
    total_rules: number
  }
  daily: TriggerDailyStat[]
  by_rule: TriggerRuleStat[]
  by_camera: TriggerCameraStat[]
  heatmap: TriggerHeatmapItem[]
}

export interface DashboardResult {
  trigger_engine: { enabled: boolean; enabled_rules: number; total_rules: number }
  today: { ai_calls: number; triggers: number; actions_executed: number; tokens_used: number }
  token_summary: TokenSummary
  action_ranking: Array<{ action: string; count: number }>
  recent_events: Array<{ time: string; rule_name: string; camera_id: string }>
}

export async function getTokenUsage(days = 30): Promise<TokenUsageResult> {
  return callTool<TokenUsageResult>('stats/token_usage', { days })
}

export async function getTokenRecords(limit = 50): Promise<{ records: TokenRecordItem[] }> {
  return callTool<{ records: TokenRecordItem[] }>('stats/token_records', { limit })
}

export async function getTriggerSummary(days = 30): Promise<TriggerSummaryResult> {
  return callTool<TriggerSummaryResult>('stats/trigger_summary', { days })
}

export async function getDashboard(): Promise<DashboardResult> {
  return callTool<DashboardResult>('stats/dashboard')
}

// ── Vision AI Config ─────────────────────────────────────────────────────────

export interface VisionConfigResult {
  enabled: boolean
  api_key_masked: string
  has_api_key: boolean
  base_url: string
  model: string
  temperature: number
  max_tokens: number
  timeout_seconds: number
}

export interface VisionConfigUpdate {
  enabled?: boolean
  api_key?: string
  base_url?: string
  model?: string
  temperature?: number
  max_tokens?: number
  timeout_seconds?: number
}

export interface VisionConfigSaveResult extends VisionConfigResult {
  success: boolean
  config_saved: boolean
  message: string
}

export async function getVisionConfig(): Promise<VisionConfigResult> {
  return callTool<VisionConfigResult>('config/get_vision')
}

export async function setVisionConfig(updates: VisionConfigUpdate): Promise<VisionConfigSaveResult> {
  return callTool<VisionConfigSaveResult>('config/set_vision', updates as Record<string, unknown>)
}

// ── Vision AI Chat ───────────────────────────────────────────────────────────

export interface VisionChatResult {
  camera_id: string
  camera_name: string
  channel: number
  content?: string
  error?: string
  images_used: number
  model: string
  tokens?: { prompt: number; completion: number }
}

export async function visionChat(
  cameraId: string,
  query: string,
  count = 3,
  channel = 0,
): Promise<VisionChatResult> {
  return callTool<VisionChatResult>('xiaomi/camera_vision_chat', {
    camera_id: cameraId,
    query,
    count,
    channel,
  })
}

// ── Trigger Config ───────────────────────────────────────────────────────────

export interface TriggerConfigResult {
  enabled: boolean
  interval_seconds: number
  vision_img_count: number
  motion_threshold: number
  log_ttl_days: number
  min_trigger_interval: number
}

export interface TriggerConfigUpdate {
  enabled?: boolean
  interval_seconds?: number
  vision_img_count?: number
  motion_threshold?: number
  log_ttl_days?: number
  min_trigger_interval?: number
}

export interface TriggerConfigSaveResult extends TriggerConfigResult {
  success: boolean
  config_saved: boolean
  message: string
}

export async function getTriggerConfig(): Promise<TriggerConfigResult> {
  return callTool<TriggerConfigResult>('config/get_trigger')
}

export async function setTriggerConfig(updates: TriggerConfigUpdate): Promise<TriggerConfigSaveResult> {
  return callTool<TriggerConfigSaveResult>('config/set_trigger', updates as Record<string, unknown>)
}

// ── Trigger Rules ────────────────────────────────────────────────────────────

export interface TriggerAction {
  tool_name: string
  arguments: Record<string, unknown>
}

export interface TriggerRule {
  id: string
  enabled: boolean
  name: string
  cameras: string[]
  condition: string
  actions?: TriggerAction[]
  notify?: { title?: string; body?: string }
  filter?: { interval?: number; period?: string }
}

export interface TriggerLog {
  id: string
  rule_id: string
  rule_name: string
  camera_id: string
  channel: number
  triggered_at: string
  condition: string
  llm_response: string
  actions_executed: string[]
}

export async function triggerCreate(rule: Partial<TriggerRule>): Promise<{ id: string; rule: TriggerRule }> {
  return callTool<{ id: string; rule: TriggerRule }>('trigger/create', rule as Record<string, unknown>)
}

export async function triggerList(): Promise<{ rules: TriggerRule[]; count: number }> {
  return callTool<{ rules: TriggerRule[]; count: number }>('trigger/list')
}

export async function triggerUpdate(id: string, updates: Partial<TriggerRule>): Promise<{ rule: TriggerRule }> {
  return callTool<{ rule: TriggerRule }>('trigger/update', { id, ...updates } as Record<string, unknown>)
}

export async function triggerDelete(id: string): Promise<{ message: string }> {
  return callTool<{ message: string }>('trigger/delete', { id })
}

export async function triggerToggle(id: string, enabled: boolean): Promise<{ rule: TriggerRule }> {
  return callTool<{ rule: TriggerRule }>('trigger/toggle', { id, enabled })
}

export async function triggerLogs(limit = 50, ruleId?: string): Promise<{ logs: TriggerLog[] }> {
  const args: Record<string, unknown> = { limit }
  if (ruleId) args.rule_id = ruleId
  return callTool<{ logs: TriggerLog[] }>('trigger/logs', args)
}

// ─── Platform (Multi-provider) APIs ─────────────────────────────

export interface PlatformInfo {
  platform_id: string
  platform_name: string
  authenticated: boolean
  auth_status: Record<string, unknown>
}

export interface TuyaQrResult {
  success: boolean
  qr_url?: string
  token?: string
  expire_time?: number
  error?: string
}

export interface TuyaQrStatusResult {
  success: boolean
  status: string
  uid?: string
  msg?: string
}

export interface TuyaDevice {
  id: string
  name: string
  model: string
  online: boolean
  category: string
  home_name: string
  room_name: string
}

export async function getPlatforms(): Promise<PlatformInfo[]> {
  return callTool<PlatformInfo[]>('auth/platforms')
}

export async function getTuyaQrCode(userCode: string): Promise<TuyaQrResult> {
  return callTool<TuyaQrResult>('auth/tuya_qr', { user_code: userCode })
}

export async function checkTuyaQrStatus(token: string, userCode: string): Promise<TuyaQrStatusResult> {
  return callTool<TuyaQrStatusResult>('auth/tuya_qr_status', { token, user_code: userCode })
}

export async function tuyaLogout(): Promise<{ success: boolean; message: string }> {
  return callTool<{ success: boolean; message: string }>('auth/tuya_logout')
}

export async function getTuyaDevices(): Promise<{ total: number; devices: TuyaDevice[] }> {
  return callTool<{ total: number; devices: TuyaDevice[] }>('device/list', { platform: 'tuya' })
}

export async function refreshTuyaDevices(): Promise<{ success: boolean; device_count: number }> {
  return callTool<{ success: boolean; device_count: number }>('tuya/refresh')
}

export async function tuyaControl(deviceId: string, dpCode: string, value: unknown): Promise<{ success: boolean; message: string }> {
  return callTool<{ success: boolean; message: string }>('set_tuya_device_property', { deviceId, code: dpCode, value })
}

export async function getAllDevices(): Promise<{ total: number; devices: Array<TuyaDevice & { platform: string }> }> {
  return callTool<{ total: number; devices: Array<TuyaDevice & { platform: string }> }>('device/list')
}

// ─── Midea (美的) APIs ─────────────────────────────────────────────

export interface MideaDevice {
  id: string
  name: string
  type: string
  online: boolean
  model_number?: string
  sn?: string
}

export async function mideaLogin(account: string, password: string): Promise<{ success: boolean; message: string; device_count?: number }> {
  return callTool('auth/midea_login', { account, password })
}

export async function mideaLogout(): Promise<{ success: boolean; message: string }> {
  return callTool('auth/midea_logout')
}

export async function getMideaDevices(): Promise<{ total: number; devices: MideaDevice[] }> {
  return callTool('device/list', { platform: 'midea' })
}

export async function refreshMideaDevices(): Promise<{ success: boolean; device_count: number }> {
  return callTool('midea/refresh')
}

export async function getMideaDeviceStatus(deviceId: string): Promise<Record<string, unknown>> {
  return callTool('get_midea_device_properties', { deviceId })
}

export async function getMideaDeviceSpecs(deviceId: string): Promise<Record<string, unknown>> {
  return callTool('device/specs', { device_id: deviceId })
}

export async function mideaControl(deviceId: string, property: string, value: unknown): Promise<{ success: boolean; message: string }> {
  return callTool('set_midea_device_property', { deviceId, property, value })
}

// ─── eWeLink (易微联) APIs ─────────────────────────────────────────

export interface EwelinkDevice {
  id: string
  name: string
  type: string
  online: boolean
  brand?: string
  model?: string
}

export async function ewelinkLogin(email: string, password: string, countryCode?: string): Promise<{ success: boolean; message: string; device_count?: number }> {
  const args: Record<string, unknown> = { email, password }
  if (countryCode) args.country_code = countryCode
  return callTool('auth/ewelink_login', args)
}

export async function ewelinkLogout(): Promise<{ success: boolean; message: string }> {
  return callTool('auth/ewelink_logout')
}

export async function getEwelinkDevices(): Promise<{ total: number; devices: EwelinkDevice[] }> {
  return callTool('device/list', { platform: 'ewelink' })
}

export async function refreshEwelinkDevices(): Promise<{ success: boolean; device_count: number }> {
  return callTool('ewelink/refresh')
}

export async function getEwelinkDeviceStatus(deviceId: string): Promise<Record<string, unknown>> {
  return callTool('get_ewelink_device_properties', { deviceId })
}

export async function getEwelinkDeviceSpecs(deviceId: string): Promise<Record<string, unknown>> {
  return callTool('device/specs', { device_id: deviceId })
}

export async function ewelinkControl(deviceId: string, property: string, value: unknown): Promise<{ success: boolean; message: string }> {
  return callTool('set_ewelink_device_property', { deviceId, property, value })
}

// ─── Schedule (定时任务) APIs ─────────────────────────────────────────

export interface ScheduleTask {
  id: number
  name: string
  scheduled_time: number
  tool_name: string
  tool_args: string
  status: string
  result: string
  created_at: number
  executed_at: number
  repeat: string
  repeat_days: number
  time_of_day: number
  execute_count: number
}

export interface ScheduleTaskSummary {
  id: number
  name: string
  scheduled_time: number
  tool_name: string
  status: string
  repeat: string
  execute_count: number
}

export async function scheduleAdd(
  name: string, scheduledTime: string, toolName: string, toolArgs: string,
  repeat?: string, repeatDays?: string
): Promise<{ success: boolean; id?: number; error?: string }> {
  const args: Record<string, unknown> = { name, scheduled_time: scheduledTime, tool_name: toolName, tool_args: toolArgs }
  if (repeat) args.repeat = repeat
  if (repeatDays) args.repeat_days = repeatDays
  return callTool('schedule/add', args)
}

export async function scheduleList(status?: string): Promise<{ total: number; tasks: ScheduleTaskSummary[] }> {
  const args: Record<string, unknown> = {}
  if (status) args.status = status
  return callTool('schedule/list', args)
}

export async function scheduleGet(id: number): Promise<ScheduleTask> {
  return callTool('schedule/get', { id })
}

export async function scheduleUpdate(
  id: number, scheduledTime?: string, repeat?: string, repeatDays?: string
): Promise<{ success: boolean; error?: string }> {
  const args: Record<string, unknown> = { id }
  if (scheduledTime) args.scheduled_time = scheduledTime
  if (repeat) args.repeat = repeat
  if (repeatDays) args.repeat_days = repeatDays
  return callTool('schedule/update', args)
}

export async function scheduleDelete(id: number): Promise<{ success: boolean; error?: string }> {
  return callTool('schedule/delete', { id })
}

export async function scheduleCancel(id: number): Promise<{ success: boolean; error?: string }> {
  return callTool('schedule/cancel', { id })
}

// ─── Memory APIs ────────────────────────────────────────────────────

export interface MemoryReadResult {
  content: string
  message?: string
}

export interface MemoryListResult {
  dates: string[]
  count: number
  has_long_term: boolean
}

export interface MemoryContextResult {
  context: string
  empty: boolean
}

export interface MemorySearchResult {
  matches: string
  message?: string
}

export async function memoryRead(type: string, date?: string): Promise<MemoryReadResult> {
  const args: Record<string, unknown> = { type }
  if (date) args.date = date
  return callTool('memory/read', args)
}

export async function memoryWrite(content: string): Promise<{ success: boolean }> {
  return callTool('memory/write', { content })
}

export async function memoryAppend(content: string, type = 'today'): Promise<{ success: boolean }> {
  return callTool('memory/append', { content, type })
}

export async function memoryList(days = 30): Promise<MemoryListResult> {
  return callTool('memory/list', { days })
}

export async function memoryContext(): Promise<MemoryContextResult> {
  return callTool('memory/context')
}

export async function memorySearch(keyword: string): Promise<MemorySearchResult> {
  return callTool('memory/search', { keyword })
}

export async function memoryDelete(date: string): Promise<{ success: boolean; date: string }> {
  return callTool('memory/delete', { date })
}

// ─── Skill APIs ─────────────────────────────────────────────────────

export interface SkillItem {
  name: string
  description: string
  source: string
  always: boolean
  tags: string[]
  path: string
}

export interface SkillDetail extends SkillItem {
  content: string
  body: string
}

export async function skillList(source = 'all'): Promise<{ skills: SkillItem[]; count: number }> {
  return callTool('skill/list', { source })
}

export async function skillRead(name: string): Promise<SkillDetail> {
  return callTool('skill/read', { name })
}

export async function skillCreate(name: string, content: string): Promise<{ success: boolean; name: string; error?: string }> {
  return callTool('skill/create', { name, content })
}

export async function skillUpdate(name: string, content: string): Promise<{ success: boolean; name: string; error?: string }> {
  return callTool('skill/update', { name, content })
}

export async function skillDelete(name: string): Promise<{ success: boolean; name: string; error?: string }> {
  return callTool('skill/delete', { name })
}

export async function skillContext(): Promise<{ context: string; skill_count: number }> {
  return callTool('skill/context')
}

export async function skillReload(): Promise<{ success: boolean; skill_count: number }> {
  return callTool('skill/reload')
}
