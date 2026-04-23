const FOTA_JSON_URL = 'https://your-ota-server.example.com/ota/fota.json'
const FOTA_PROXY_PATH = '/ota/fota.json'
const APP_FOTA_TYPE = 'feyagate-desktop'

const CURRENT_VERSION = '1.2.14'

export interface UpdateInfo {
  version: string
  url: string
  md5: string
  release_notes: string
  force_update: boolean
  type: string
  size?: number
}

export interface UpdateCheckResult {
  hasUpdate: boolean
  updateInfo: UpdateInfo | null
  currentVersion: string
}

function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number)
  const parts2 = v2.split('.').map(Number)
  const len = Math.max(parts1.length, parts2.length)
  for (let i = 0; i < len; i++) {
    const p1 = parts1[i] ?? 0
    const p2 = parts2[i] ?? 0
    if (p1 !== p2) return p1 - p2
  }
  return 0
}

function getPlatformSuffix(): string {
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('mac')) return 'mac'
  if (ua.includes('win')) return 'win'
  return 'linux'
}

async function fetchFotaJson(): Promise<unknown> {
  // Electron mode: use main-process IPC to bypass CORS
  if (window.feyagate?.fetchUrl) {
    return window.feyagate.fetchUrl(FOTA_JSON_URL)
  }
  // Embedded browser mode (served by C++ server): try server-side proxy first
  try {
    const resp = await fetch(FOTA_PROXY_PATH, { signal: AbortSignal.timeout(10000) })
    if (resp.ok) return resp.json()
  } catch { /* proxy not available, try direct */ }
  // Direct fetch (works when CORS is allowed or via Vite dev proxy)
  const resp = await fetch(FOTA_JSON_URL, { signal: AbortSignal.timeout(10000) })
  return resp.json()
}

export async function checkForUpdate(): Promise<UpdateCheckResult> {
  const data = await fetchFotaJson()

  if (!Array.isArray(data)) {
    throw new Error('Invalid fota.json format')
  }

  const platform = getPlatformSuffix()
  const platformType = `${APP_FOTA_TYPE}-${platform}`

  let entry = data.find((e: UpdateInfo) => e.type === platformType)
  if (!entry) {
    entry = data.find((e: UpdateInfo) => e.type === APP_FOTA_TYPE)
  }

  if (!entry) {
    return { hasUpdate: false, updateInfo: null, currentVersion: CURRENT_VERSION }
  }

  const remoteVersion = entry.version || ''
  if (compareVersions(remoteVersion, CURRENT_VERSION) > 0) {
    return {
      hasUpdate: true,
      updateInfo: entry as UpdateInfo,
      currentVersion: CURRENT_VERSION,
    }
  }

  return { hasUpdate: false, updateInfo: null, currentVersion: CURRENT_VERSION }
}

export function getCurrentVersion(): string {
  return CURRENT_VERSION
}

export function openDownloadUrl(url: string) {
  const open = window.feyagate?.openExternal ?? ((u: string) => { window.open(u, '_blank') })
  open(url)
}
