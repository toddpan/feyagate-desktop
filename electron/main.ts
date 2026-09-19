import { app, BrowserWindow, ipcMain, shell, screen, Tray, Menu, nativeImage } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { spawn, ChildProcess, execSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null
let oauthWindow: BrowserWindow | null = null
let wechatOAuthWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
// macOS 26 (Tahoe) 起, 菜单栏图标改由 ControlCenter/StatusKit 统一排布, 新建的
// 状态项可能被排到屏幕外 (实测 y=-17) → 图标"已创建但看不见". 重建状态项是已知的
// 恢复手段, 这里限制重建次数, 避免无谓循环 (见 recoverTrayIfHidden).
const TRAY_MAX_REBUILD = 2
let serverUrl = 'http://localhost:38090'
let serverProcess: ChildProcess | null = null
let serverStarting = false
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

  const pidFile = path.join(userDataDir, 'server.pid')

  return { binary, defaultConfig, userDataDir, userConfig, tokenFile, pidFile }
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

function copyDirRecursive(src: string, dest: string) {
  if (!fs.existsSync(src)) return
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

async function ensureUserConfig(): Promise<string> {
  const { defaultConfig, userDataDir, userConfig } = getServerPaths()

  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true })
  }

  if (!fs.existsSync(userConfig)) {
    fs.copyFileSync(defaultConfig, userConfig)
  }

  const isDev = !!VITE_DEV_SERVER_URL
  const resourceBase = isDev
    ? path.resolve(__dirname, '../resources/server')
    : path.join(process.resourcesPath!, 'server')
  const builtinSkillsSrc = path.join(resourceBase, 'skills')
  const builtinSkillsDest = path.join(userDataDir, 'skills')
  if (fs.existsSync(builtinSkillsSrc)) {
    copyDirRecursive(builtinSkillsSrc, builtinSkillsDest)
    console.log('[MCP Server] Synced built-in skills to', builtinSkillsDest)
  }

  const dataMemory = path.join(userDataDir, 'data', 'memory')
  if (!fs.existsSync(dataMemory)) {
    fs.mkdirSync(dataMemory, { recursive: true })
  }
  const dataSkills = path.join(userDataDir, 'data', 'skills')
  if (!fs.existsSync(dataSkills)) {
    fs.mkdirSync(dataSkills, { recursive: true })
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
  if (serverStarting) {
    console.log('[MCP Server] Already starting, skipping duplicate call')
    return false
  }
  if (serverProcess && !serverProcess.killed) {
    console.log('[MCP Server] Already running (pid=' + serverProcess.pid + '), skipping')
    return true
  }

  serverStarting = true

  try {
    killStaleServerProcesses()

    const { binary } = getServerPaths()

    if (!fs.existsSync(binary)) {
      console.error('[MCP Server] Binary not found:', binary)
      return false
    }

    const configPath = await ensureUserConfig()

    console.log('[MCP Server] Starting:', binary)
    console.log('[MCP Server] Config:', configPath)

    return await new Promise<boolean>((resolve) => {
      serverProcess = spawn(binary, ['--config', configPath], {
        cwd: path.dirname(configPath),
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      if (serverProcess.pid) {
        writePidFile(serverProcess.pid)
        console.log(`[MCP Server] Spawned with pid=${serverProcess.pid}`)
      }

      serverProcess.stdout?.on('data', (data: Buffer) => {
        console.log('[MCP Server]', data.toString().trimEnd())
      })

      serverProcess.stderr?.on('data', (data: Buffer) => {
        console.error('[MCP Server]', data.toString().trimEnd())
      })

      serverProcess.on('exit', (code, signal) => {
        console.log(`[MCP Server] Exited: code=${code} signal=${signal}`)
        serverProcess = null
        removePidFile()
        if (!isQuitting && code !== 0 && code !== null && signal !== 'SIGTERM' && signal !== 'SIGKILL') {
          console.log('[MCP Server] Unexpected exit, restarting in 2s...')
          setTimeout(() => {
            startServer().then((ok) => {
              if (ok && mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('server-ready')
              }
              updateTrayMenu()
            })
          }, 2000)
        }
      })

      serverProcess.on('error', (err) => {
        console.error('[MCP Server] Spawn error:', err.message)
        serverProcess = null
        removePidFile()
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
  } finally {
    serverStarting = false
  }
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

function writePidFile(pid: number) {
  try {
    const { pidFile } = getServerPaths()
    fs.writeFileSync(pidFile, String(pid), 'utf-8')
  } catch (err) {
    console.error('[MCP Server] Failed to write PID file:', err)
  }
}

function removePidFile() {
  try {
    const { pidFile } = getServerPaths()
    if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile)
  } catch { /* ignore */ }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function killProcess(pid: number) {
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' })
    } else {
      process.kill(pid, 'SIGTERM')
      setTimeout(() => {
        if (isProcessAlive(pid)) {
          try { process.kill(pid, 'SIGKILL') } catch { /* already dead */ }
        }
      }, 2000)
    }
  } catch { /* already dead */ }
}

function killStaleServerProcesses() {
  const { pidFile, binary } = getServerPaths()
  const binaryName = path.basename(binary)

  // 1) Check PID file for leftover process from previous session
  if (fs.existsSync(pidFile)) {
    try {
      const oldPid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim(), 10)
      if (oldPid && isProcessAlive(oldPid)) {
        console.log(`[MCP Server] Killing stale process from PID file: ${oldPid}`)
        killProcess(oldPid)
      }
    } catch { /* ignore */ }
    removePidFile()
  }

  // 2) Scan for any orphaned miloco-mcp-server processes by name
  try {
    if (process.platform === 'win32') {
      const list = execSync(`tasklist /FI "IMAGENAME eq ${binaryName}.exe" /FO CSV /NH`, { encoding: 'utf-8' })
      for (const line of list.split('\n')) {
        const match = line.match(/"[^"]+","(\d+)"/)
        if (match) {
          const pid = parseInt(match[1], 10)
          console.log(`[MCP Server] Killing orphaned process (Windows): ${pid}`)
          killProcess(pid)
        }
      }
    } else {
      const pids = execSync(`pgrep -f "${binaryName}" 2>/dev/null || true`, { encoding: 'utf-8' }).trim()
      if (pids) {
        for (const pidStr of pids.split('\n')) {
          const pid = parseInt(pidStr.trim(), 10)
          if (pid && pid !== process.pid && isProcessAlive(pid)) {
            console.log(`[MCP Server] Killing orphaned process: ${pid}`)
            killProcess(pid)
          }
        }
      }
    }
  } catch { /* pgrep/tasklist not available */ }
}

function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!serverProcess) {
      removePidFile()
      resolve()
      return
    }
    console.log('[MCP Server] Stopping...')
    const pid = serverProcess.pid

    const forceKillTimer = setTimeout(() => {
      if (serverProcess && !serverProcess.killed) {
        console.log('[MCP Server] Force killing...')
        serverProcess.kill('SIGKILL')
      }
    }, 3000)

    const exitHandler = () => {
      clearTimeout(forceKillTimer)
      serverProcess = null
      removePidFile()
      resolve()
    }

    if (serverProcess.exitCode !== null) {
      exitHandler()
      return
    }

    serverProcess.once('exit', exitHandler)
    serverProcess.kill('SIGTERM')

    // Safety timeout: resolve even if exit event never fires
    setTimeout(() => {
      if (pid && isProcessAlive(pid)) {
        try { process.kill(pid, 'SIGKILL') } catch { /* */ }
      }
      serverProcess = null
      removePidFile()
      resolve()
    }, 5000)
  })
}

function getIconDir(): string {
  const isDev = !!VITE_DEV_SERVER_URL

  if (isDev) {
    // In dev mode, __dirname is dist-electron/, go up to project root then into resources/icons
    const projectRoot = path.resolve(__dirname, '../..')
    return path.join(projectRoot, 'resources', 'icons')
  }

  return path.join(process.resourcesPath!, 'icons')
}

function getTrayIconPath(): string {
  const iconDir = getIconDir()

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
  console.log('[Tray] Icon path:', iconPath)

  let icon = nativeImage.createFromPath(iconPath)

  if (icon.isEmpty()) {
    console.warn('[Tray] Icon is empty, trying fallback icons')
    const iconDir = getIconDir()

    const fallbacks = process.platform === 'darwin'
      ? ['trayTemplate@2x.png', 'tray-32.png', 'tray-32-256.png']
      : ['tray-32.png', 'tray-32-256.png', 'tray-16.png']

    for (const fallbackName of fallbacks) {
      const fallbackPath = path.join(iconDir, fallbackName)
      console.log('[Tray] Trying fallback:', fallbackPath)
      icon = nativeImage.createFromPath(fallbackPath)
      if (!icon.isEmpty()) {
        console.log('[Tray] Using fallback icon:', fallbackName)
        break
      }
    }
  }

  if (icon.isEmpty()) {
    console.error('[Tray] All icons failed to load, creating 16x16 placeholder')
    icon = nativeImage.createFromBuffer(Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00, 0x10,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0xf3, 0xff, 0x61, 0x00, 0x00, 0x00,
      0x1a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x62, 0x60, 0x40, 0x05, 0x23,
      0x23, 0x23, 0xff, 0xff, 0xff, 0x00, 0x06, 0x10, 0x00, 0x01, 0x5d, 0x50,
      0x01, 0x7b, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42,
      0x60, 0x82
    ]))
  }

  tray = new Tray(icon)
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
        await stopServer()
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

/**
 * macOS 26.5 (Tahoe) 会把第三方状态项排到屏幕外 (实测 frame y=-17, 或宽高为 0),
 * 图标就"存在但看不见". 应用侧无法直接把状态项挪回可见位置 (系统限制), 但重建
 * 状态项常能换回一次可用排布 —— 这是上游多个项目采用的恢复手段
 * (oMLX #1497, CodexBar #998, 同为 Tahoe 26.5).
 */
/**
 * 判断状态项是否落在"看不见"的位置, 没问题时返回 null.
 * 已知两种坏位置:
 *  ① 被排到屏幕外 (y<0) 或没有尺寸 —— 上游 oMLX #1497 在 Tahoe 26.5 的现象;
 *  ② 被排到菜单栏正中 —— 带刘海的 MacBook 上正中就是刘海, 系统不会在刘海下绘制
 *     任何东西, 图标因此看不见 (本机实测状态项 x=729..767, 刘海区间 x=646..825).
 */
function describeTrayProblem(
  bounds: { x: number; y: number; width: number; height: number }
): string | null {
  if (bounds.y < 0) return `状态项被排到屏幕外 (y=${bounds.y})`
  if (bounds.width <= 0 || bounds.height <= 0) {
    return `状态项没有尺寸 (${bounds.width}x${bounds.height})`
  }

  // 正常状态项贴在菜单栏右侧; 落在屏幕正中即异常 (刘海机型正中恰是刘海)
  const screenWidth = screen.getPrimaryDisplay().bounds.width
  const center = bounds.x + bounds.width / 2
  if (Math.abs(center - screenWidth / 2) < screenWidth * 0.1) {
    return (
      `状态项落在菜单栏正中 (x=${bounds.x}..${bounds.x + bounds.width}, 屏幕正中=${screenWidth / 2})` +
      ' —— 刘海机型上正中被刘海遮住, 等于看不见'
    )
  }

  return null
}

function recoverTrayIfHidden(attempt = 1): void {
  if (process.platform !== 'darwin') return

  const current = tray
  if (!current || current.isDestroyed()) return

  let bounds: { x: number; y: number; width: number; height: number }
  try {
    bounds = current.getBounds()
  } catch (err) {
    console.warn('[Tray] 读取状态项位置失败:', err)
    return
  }

  console.log(`[Tray] 状态项位置: x=${bounds.x} y=${bounds.y} ${bounds.width}x${bounds.height}`)

  const problem = describeTrayProblem(bounds)
  if (!problem) {
    if (attempt > 1) console.log('[Tray] 状态项已回到可见位置')
    return
  }

  if (attempt > TRAY_MAX_REBUILD) {
    console.warn(
      `[Tray] ${problem} —— 重建 ${TRAY_MAX_REBUILD} 次仍未落回可见位置. ` +
      '这是 macOS 26.5 (Tahoe) 的系统排布问题, 非本应用缺陷. ' +
      '托盘图标可能暂时不可见, 可从 Dock 图标打开主窗口.'
    )
    return
  }

  console.warn(`[Tray] ${problem}, 重建状态项 (第 ${attempt}/${TRAY_MAX_REBUILD} 次)`)
  current.destroy()
  tray = null
  createTray()
  updateTrayMenu()
  setTimeout(() => recoverTrayIfHidden(attempt + 1), 2000)
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
        await stopServer()
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
  await stopServer()
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

  // 等菜单栏排布稳定后复核状态项是否真的落在可见位置 (macOS 26.5 会排到屏幕外)
  setTimeout(() => recoverTrayIfHidden(), 2500)

  // 显示器变化 / 分辨率切换后系统会重排菜单栏, 同样需要复核
  screen.on('display-metrics-changed', () => setTimeout(() => recoverTrayIfHidden(), 1500))
  screen.on('display-added', () => setTimeout(() => recoverTrayIfHidden(), 1500))
  screen.on('display-removed', () => setTimeout(() => recoverTrayIfHidden(), 1500))
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
