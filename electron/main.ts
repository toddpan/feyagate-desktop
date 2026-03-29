import { app, BrowserWindow, ipcMain, shell, session } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { spawn, ChildProcess } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null
let oauthWindow: BrowserWindow | null = null
let serverUrl = 'http://localhost:38080'
let serverProcess: ChildProcess | null = null
const DEFAULT_HTTP_PORT = 38080

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

function getServerPaths() {
  const isDev = !!VITE_DEV_SERVER_URL
  const resourceBase = isDev
    ? path.resolve(__dirname, '../resources/server')
    : path.join(process.resourcesPath!, 'server')

  const ext = process.platform === 'win32' ? '.exe' : ''
  const binary = path.join(resourceBase, `miloco-mcp-server${ext}`)
  const defaultConfig = path.join(resourceBase, 'config.yaml')

  const userDataDir = path.join(app.getPath('userData'), 'server-data')
  const userConfig = path.join(userDataDir, 'config.yaml')
  const tokenFile = path.join(userDataDir, 'auth_token.json')

  return { binary, defaultConfig, userDataDir, userConfig, tokenFile }
}

function ensureUserConfig() {
  const { defaultConfig, userDataDir, userConfig } = getServerPaths()

  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true })
  }

  if (!fs.existsSync(userConfig)) {
    fs.copyFileSync(defaultConfig, userConfig)
  }

  let cfg = fs.readFileSync(userConfig, 'utf-8')
  const { tokenFile } = getServerPaths()
  cfg = cfg.replace(
    /token_file:\s*"[^"]*"/,
    `token_file: "${tokenFile.replace(/\\/g, '/')}"`
  )
  fs.writeFileSync(userConfig, cfg, 'utf-8')

  const portMatch = cfg.match(/http_port:\s*(\d+)/)
  const port = portMatch ? parseInt(portMatch[1], 10) : DEFAULT_HTTP_PORT
  serverUrl = `http://localhost:${port}`
  console.log(`[MCP Server] Detected port from config: ${port}`)

  return userConfig
}

function startServer(): Promise<boolean> {
  return new Promise((resolve) => {
    const { binary } = getServerPaths()

    if (!fs.existsSync(binary)) {
      console.error('[MCP Server] Binary not found:', binary)
      resolve(false)
      return
    }

    const configPath = ensureUserConfig()

    console.log('[MCP Server] Starting:', binary)
    console.log('[MCP Server] Config:', configPath)

    serverProcess = spawn(binary, ['--config', configPath], {
      cwd: path.dirname(configPath),
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    serverProcess.stdout?.on('data', (data: Buffer) => {
      console.log('[MCP Server]', data.toString().trimEnd())
    })

    serverProcess.stderr?.on('data', (data: Buffer) => {
      console.error('[MCP Server]', data.toString().trimEnd())
    })

    serverProcess.on('exit', (code, signal) => {
      console.log(`[MCP Server] Exited: code=${code} signal=${signal}`)
      serverProcess = null
    })

    serverProcess.on('error', (err) => {
      console.error('[MCP Server] Spawn error:', err.message)
      serverProcess = null
      resolve(false)
    })

    waitForServerReady()
      .then((ok) => {
        if (ok) {
          console.log('[MCP Server] Server is ready')
          notifyServerReady()
        }
        resolve(ok)
      })
  })
}

function notifyServerReady() {
  if (!mainWindow) return
  const send = () => mainWindow?.webContents.send('server-ready')
  if (mainWindow.webContents.isLoading()) {
    mainWindow.webContents.once('did-finish-load', send)
  } else {
    send()
  }
}

async function waitForServerReady(maxRetries = 30, intervalMs = 500): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const resp = await fetch(`${serverUrl}/health`, { signal: AbortSignal.timeout(1000) })
      const json = await resp.json()
      if (json.status === 'ok') return true
    } catch { /* server not ready yet */ }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  console.error('[MCP Server] Timed out waiting for server to become ready')
  return false
}

function stopServer() {
  if (!serverProcess) return
  console.log('[MCP Server] Stopping...')
  serverProcess.kill('SIGTERM')
  setTimeout(() => {
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill('SIGKILL')
    }
  }, 3000)
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'FeyaGate Desktop',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

async function mcpJsonRpc(method: string, params?: Record<string, unknown>): Promise<unknown> {
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: Date.now(),
    method,
    params: params ?? {},
  })

  const resp = await fetch(`${serverUrl}/mcp/http`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })

  const json = await resp.json()
  if (json.error) {
    throw new Error(json.error.message || JSON.stringify(json.error))
  }
  return json.result
}

async function healthCheck(): Promise<boolean> {
  try {
    const resp = await fetch(`${serverUrl}/health`, { signal: AbortSignal.timeout(3000) })
    const json = await resp.json()
    return json.status === 'ok'
  } catch {
    return false
  }
}

function openOAuthWindow(url: string) {
  if (oauthWindow) {
    oauthWindow.focus()
    return
  }

  oauthWindow = new BrowserWindow({
    width: 800,
    height: 700,
    parent: mainWindow ?? undefined,
    modal: false,
    title: 'Xiaomi Login',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // Intercept redirect to https://127.0.0.1 to capture OAuth code
  oauthWindow.webContents.session.webRequest.onBeforeRequest(
    { urls: ['https://127.0.0.1/*'] },
    (details, callback) => {
      const url = new URL(details.url)
      const code = url.searchParams.get('code')
      if (code && mainWindow) {
        mainWindow.webContents.send('oauth-code', code)
      }
      callback({ cancel: true })
      oauthWindow?.close()
    }
  )

  oauthWindow.loadURL(url)

  oauthWindow.on('closed', () => {
    oauthWindow = null
  })
}

// IPC handlers
ipcMain.handle('mcp-call', async (_event, method: string, params?: Record<string, unknown>) => {
  return mcpJsonRpc(method, params)
})

ipcMain.handle('call-tool', async (_event, name: string, args?: Record<string, unknown>) => {
  return mcpJsonRpc('tools/call', { name, arguments: args ?? {} })
})

ipcMain.handle('open-oauth', async (_event, url: string) => {
  openOAuthWindow(url)
})

ipcMain.handle('get-server-url', async () => {
  return serverUrl
})

ipcMain.handle('set-server-url', async (_event, url: string) => {
  serverUrl = url.replace(/\/+$/, '')
})

ipcMain.handle('health-check', async () => {
  return healthCheck()
})

ipcMain.handle('open-external', async (_event, url: string) => {
  shell.openExternal(url)
})

ipcMain.handle('fetch-url', async (_event, url: string) => {
  const resp = await fetch(url, { signal: AbortSignal.timeout(10000) })
  return resp.json()
})

ipcMain.handle('server-status', async () => {
  return { running: serverProcess !== null && !serverProcess.killed }
})

ipcMain.handle('restart-server', async () => {
  stopServer()
  await new Promise((r) => setTimeout(r, 1000))
  return startServer()
})

app.whenReady().then(async () => {
  createWindow()
  await startServer()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  stopServer()
})
