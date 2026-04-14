const STORE_BASE_URL = 'https://www.feyagate.com'
const APP_ID = 'feyagate-web-app'
const APP_SECRET = 'b3f8a2d9c7e1f4b6a0d3e5f7c9b2a4d6e8f0b1c3d5a7e9f2b4c6d8a0e2f4b6c8'

function hexToBytes(hex: string): Uint8Array {
  const b = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) b[i / 2] = parseInt(hex.substr(i, 2), 16)
  return b
}

function bytesToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function sha256Hex(str: string): Promise<string> {
  const data = new TextEncoder().encode(str)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return bytesToHex(hash)
}

async function hmacSha256Sign(hexKey: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', hexToBytes(hexKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return bytesToHex(sig)
}

async function signedHeaders(method: string, path: string, bodyStr?: string): Promise<Record<string, string>> {
  const ts = Math.floor(Date.now() / 1000)
  let bodyHash = ''
  if (method === 'POST' || method === 'PUT') bodyHash = await sha256Hex(bodyStr || '')
  const signData = method + '\n' + path + '\n' + ts + '\n' + bodyHash
  const sig = await hmacSha256Sign(APP_SECRET, signData)
  return { 'X-HA-App-Id': APP_ID, 'X-HA-Timestamp': String(ts), 'X-HA-Signature': sig }
}

async function storeGet<T>(path: string): Promise<T> {
  const url = `${STORE_BASE_URL}/api/v1${path}`
  const headers = await signedHeaders('GET', `/api/v1${path}`)
  const resp = await fetch(url, { headers })
  const json = await resp.json()
  if (json.code !== 0) throw new Error(json.message || 'Request failed')
  return json.data as T
}

async function storePost<T>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  const url = `${STORE_BASE_URL}/api/v1${path}`
  const bodyStr = JSON.stringify(body)
  const headers = await signedHeaders('POST', `/api/v1${path}`, bodyStr)
  const resp = await fetch(url, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: bodyStr,
  })
  const json = await resp.json()
  if (json.code !== 0) throw new Error(json.message || 'Request failed')
  return json.data as T
}

// --- Types ---

export interface StoreSkill {
  id: string
  name: string
  description: string
  category: string
  tags: string
  icon: string
  author: string
  version: number
  always: boolean
  content: string
  download_count: number
  published_at: string
}

export interface StoreListResponse {
  total: number
  page: number
  size: number
  skills: StoreSkill[]
}

export interface CategoryCount {
  category: string
  count: number
}

// --- API Functions ---

export async function fetchSkillStoreList(
  page = 1,
  size = 20,
  category = '',
  keyword = '',
): Promise<StoreListResponse> {
  let path = `/skill-store/list?page=${page}&size=${size}`
  if (category) path += `&category=${encodeURIComponent(category)}`
  if (keyword) path += `&keyword=${encodeURIComponent(keyword)}`
  return storeGet<StoreListResponse>(path)
}

export async function fetchSkillStoreDetail(id: string): Promise<StoreSkill> {
  return storeGet<StoreSkill>(`/skill-store/${id}`)
}

export async function downloadSkill(id: string): Promise<StoreSkill> {
  return storePost<StoreSkill>(`/skill-store/${id}/download`)
}

export async function fetchSkillStoreCategories(): Promise<CategoryCount[]> {
  return storeGet<CategoryCount[]>('/skill-store/categories')
}
