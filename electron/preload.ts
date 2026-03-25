import { contextBridge, ipcRenderer } from 'electron'

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

  getServerUrl: () =>
    ipcRenderer.invoke('get-server-url'),

  setServerUrl: (url: string) =>
    ipcRenderer.invoke('set-server-url', url),

  healthCheck: () =>
    ipcRenderer.invoke('health-check'),

  openExternal: (url: string) =>
    ipcRenderer.invoke('open-external', url),
})
