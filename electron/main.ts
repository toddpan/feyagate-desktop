import { app, BrowserWindow, ipcMain, shell, session } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null
let oauthWindow: BrowserWindow | null = null
let serverUrl = 'http://localhost:8080'

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

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

app.whenReady().then(() => {
  createWindow()

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
