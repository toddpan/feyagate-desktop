import { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { spawn, ChildProcess } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null
let oauthWindow: BrowserWindow | null = null
let wechatOAuthWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let serverUrl = 'http://localhost:38090'
let serverProcess: ChildProcess | null = null
const DEFAULT_HTTP_PORT = 38090

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

import net from 'node:net'

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = net.createServer()
    srv.once('error', () => resolve(false))
    srv.listen(port, '127.0.0.1', () => {
      srv.close(() => resolve(true))
    })
  })
}

async function findFreePort(preferred: number, maxAttempts = 20): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = preferred + i
    if (await isPortFree(port)) return port
  }
  return 0
}

async function ensureUserConfig(): Promise<string> {
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
  const configuredPort = portMatch ? parseInt(portMatch[1], 10) : DEFAULT_HTTP_PORT
  const freePort = await findFreePort(configuredPort)

  let launchConfig = userConfig
  if (freePort === 0) {
    console.error('[MCP Server] No free port found starting from', configuredPort)
  } else if (freePort !== configuredPort) {
    console.log(`[MCP Server] Port ${configuredPort} busy, using ${freePort}`)
    const runtimeCfg = cfg.replace(/http_port:\s*\d+/, `http_port: ${freePort}`)
    const runtimeConfig = path.join(userDataDir, 'config.runtime.yaml')
    fs.writeFileSync(runtimeConfig, runtimeCfg, 'utf-8')
    launchConfig = runtimeConfig
  }

  const port = freePort || configuredPort
  serverUrl = `http://localhost:${port}`
  console.log(`[MCP Server] Using port: ${port}`)

  return launchConfig
}

async function startServer(): Promise<boolean> {
  const { binary } = getServerPaths()

  if (!fs.existsSync(binary)) {
    console.error('[MCP Server] Binary not found:', binary)
    return false
  }

  const configPath = await ensureUserConfig()

  console.log('[MCP Server] Starting:', binary)
  console.log('[MCP Server] Config:', configPath)

  return new Promise((resolve) => {
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
      if (code !== 0 && code !== null && signal !== 'SIGTERM' && signal !== 'SIGKILL') {
        console.log('[MCP Server] Unexpected exit, restarting in 2s...')
        setTimeout(() => {
          startServer().then((ok) => {
            if (ok && mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('server-ready')
            }
          })
        }, 2000)
      }
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

function getTrayIconPath(): string {
  const isDev = !!VITE_DEV_SERVER_URL
  const iconDir = isDev
    ? path.resolve(__dirname, '../resources/icons')
    : path.join(process.resourcesPath!, 'icons')

  if (process.platform === 'darwin') {
    return path.join(iconDir, 'trayTemplate.png')
  }
  return path.join(iconDir, 'tray-32.png')
}

function showMainWindow() {
  if (process.platform === 'darwin') {
    app.dock?.show()
  }
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow()
  } else {
    mainWindow.show()
    mainWindow.focus()
  }
}

function createTray() {
  if (tray) return

  const iconPath = getTrayIconPath()
  const icon = nativeImage.createFromPath(iconPath)

  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon)
  tray.setToolTip('FeyaGate Desktop')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => showMainWindow(),
    },
    { type: 'separator' },
    {
      label: serverProcess && !serverProcess.killed ? '✅ MCP 服务运行中' : '❌ MCP 服务已停止',
      enabled: false,
    },
    {
      label: '重启服务',
      click: async () => {
        stopServer()
        await new Promise((r) => setTimeout(r, 1000))
        const ok = await startServer()
        if (ok && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('server-ready')
        }
        updateTrayMenu()
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true
        app.quit()
      },
    },
  ])

  tray.setContextMenu(contextMenu)

  tray.on('double-click', () => showMainWindow())
}

function updateTrayMenu() {
  if (!tray) return
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => showMainWindow(),
    },
    { type: 'separator' },
    {
      label: serverProcess && !serverProcess.killed ? '✅ MCP 服务运行中' : '❌ MCP 服务已停止',
      enabled: false,
    },
    {
      label: '重启服务',
      click: async () => {
        stopServer()
        await new Promise((r) => setTimeout(r, 1000))
        const ok = await startServer()
        if (ok && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('server-ready')
        }
        updateTrayMenu()
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true
        app.quit()
      },
    },
  ])
  tray.setContextMenu(contextMenu)
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

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
      if (process.platform === 'darwin') {
        app.dock?.hide()
      }
    }
  })

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
    if (oauthWindow.isDestroyed()) {
      oauthWindow = null
    } else {
      oauthWindow.focus()
      return
    }
  }

  let codeHandled = false
  const parent = mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined

  oauthWindow = new BrowserWindow({
    width: 800,
    height: 700,
    parent,
    modal: false,
    title: 'Xiaomi Login',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      partition: 'persist:oauth',
    },
  })

  function redirectToServerCallback(redirectUrl: string): boolean {
    if (codeHandled) return true
    if (!redirectUrl.startsWith('https://127.0.0.1')) return false

    let code: string | null = null
    try {
      const parsed = new URL(redirectUrl)
      code = parsed.searchParams.get('code')
    } catch {
      return false
    }
    if (!code) return false

    codeHandled = true
    console.log('[OAuth] Captured code, redirecting to server /auth/callback')

    const callbackUrl = `${serverUrl}/auth/callback?code=${encodeURIComponent(code)}`
    if (oauthWindow && !oauthWindow.isDestroyed()) {
      oauthWindow.loadURL(callbackUrl)
    }
    return true
  }

  // Primary: intercept navigation before it happens
  oauthWindow.webContents.on('will-navigate', (event, navUrl) => {
    if (redirectToServerCallback(navUrl)) {
      event.preventDefault()
    }
  })

  oauthWindow.webContents.on('will-redirect', (event, navUrl) => {
    if (redirectToServerCallback(navUrl)) {
      event.preventDefault()
    }
  })

  // Backup: webRequest filter (isolated to this session via partition)
  oauthWindow.webContents.session.webRequest.onBeforeRequest(
    { urls: ['https://127.0.0.1/*'] },
    (details, callback) => {
      redirectToServerCallback(details.url)
      callback({ cancel: true })
    }
  )

  // Last resort: page failed to load — extract code from the failed URL
  oauthWindow.webContents.on('did-fail-load', (_event, _errorCode, _errorDesc, failedUrl) => {
    redirectToServerCallback(failedUrl)
  })

  // After server callback page loads, notify renderer to refresh auth status
  oauthWindow.webContents.on('did-finish-load', () => {
    if (!oauthWindow || oauthWindow.isDestroyed()) return
    const currentUrl = oauthWindow.webContents.getURL()
    if (currentUrl.includes('/auth/callback')) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('auth-success')
      }
      setTimeout(() => {
        if (oauthWindow && !oauthWindow.isDestroyed()) {
          oauthWindow.close()
        }
      }, 3000)
    }
  })

  oauthWindow.loadURL(url)

  oauthWindow.on('closed', () => {
    oauthWindow = null
  })
}

function openWeChatOAuthWindow(qrUrl: string, callbackHost: string) {
  if (wechatOAuthWindow) {
    if (wechatOAuthWindow.isDestroyed()) {
      wechatOAuthWindow = null
    } else {
      wechatOAuthWindow.focus()
      return
    }
  }

  let codeHandled = false
  const parent = mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined

  wechatOAuthWindow = new BrowserWindow({
    width: 520,
    height: 640,
    parent,
    modal: false,
    title: '微信扫码登录',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  function tryExtractCode(url: string): boolean {
    if (codeHandled) return true
    if (!url.includes(callbackHost)) return false

    let code: string | null = null
    try {
      const parsed = new URL(url)
      code = parsed.searchParams.get('code')
    } catch {
      return false
    }
    if (!code) return false

    codeHandled = true
    console.log('[WeChat OAuth] Captured code from callback')

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('wechat-auth-code', code)
    }

    setTimeout(() => {
      if (wechatOAuthWindow && !wechatOAuthWindow.isDestroyed()) {
        wechatOAuthWindow.close()
      }
    }, 500)
    return true
  }

  wechatOAuthWindow.webContents.on('will-navigate', (event, navUrl) => {
    if (tryExtractCode(navUrl)) {
      event.preventDefault()
    }
  })

  wechatOAuthWindow.webContents.on('will-redirect', (event, navUrl) => {
    if (tryExtractCode(navUrl)) {
      event.preventDefault()
    }
  })

  wechatOAuthWindow.webContents.on('did-navigate', (_event, navUrl) => {
    tryExtractCode(navUrl)
  })

  wechatOAuthWindow.webContents.on('did-fail-load', (_event, _errorCode, _errorDesc, failedUrl) => {
    tryExtractCode(failedUrl)
  })

  wechatOAuthWindow.loadURL(qrUrl)

  wechatOAuthWindow.on('closed', () => {
    wechatOAuthWindow = null
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

ipcMain.handle('open-wechat-oauth', async (_event, qrUrl: string, callbackHost: string) => {
  openWeChatOAuthWindow(qrUrl, callbackHost)
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
  createTray()
  createWindow()
  await startServer()
  updateTrayMenu()

  app.on('activate', () => {
    showMainWindow()
    if (process.platform === 'darwin') {
      app.dock?.show()
    }
  })
})

app.on('window-all-closed', () => {
  // With tray support, don't quit when all windows are closed
})

app.on('before-quit', () => {
  isQuitting = true
  stopServer()
  if (tray) {
    tray.destroy()
    tray = null
  }
})
