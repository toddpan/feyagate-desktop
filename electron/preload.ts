// eslint-disable-next-line @typescript-eslint/no-require-imports
const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron')

contextBridge.exposeInMainWorld('feyagate', {
  mcpCall: (method: string, params?: Record<string, unknown>) =>
    ipcRenderer.invoke('mcp-call', method, params),

  callTool: (name: string, args?: Record<string, unknown>) =>
    ipcRenderer.invoke('call-tool', name, args),

  openOAuth: (url: string) =>
    ipcRenderer.invoke('open-oauth', url),

  onAuthCode: (callback: (code: string) => void) => {
    ipcRenderer.on('oauth-code', (_event, code: string) => callback(code))
  },

  onAuthSuccess: (callback: () => void) => {
    ipcRenderer.on('auth-success', () => callback())
  },

  getServerUrl: () =>
    ipcRenderer.invoke('get-server-url'),

  setServerUrl: (url: string) =>
    ipcRenderer.invoke('set-server-url', url),

  healthCheck: () =>
    ipcRenderer.invoke('health-check'),

  openExternal: (url: string) =>
    ipcRenderer.invoke('open-external', url),

  fetchUrl: (url: string) =>
    ipcRenderer.invoke('fetch-url', url),

  onServerReady: (callback: () => void) => {
    ipcRenderer.on('server-ready', () => callback())
  },

  getServerStatus: () =>
    ipcRenderer.invoke('server-status'),

  restartServer: () =>
    ipcRenderer.invoke('restart-server'),
})
