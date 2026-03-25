/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    VITE_DEV_SERVER_URL: string
  }
}

interface Window {
  feyagate?: {
    mcpCall: (method: string, params?: Record<string, unknown>) => Promise<unknown>
    callTool: (name: string, args?: Record<string, unknown>) => Promise<unknown>
    openOAuth: (url: string) => Promise<void>
    onAuthCode: (callback: (code: string) => void) => void
    getServerUrl: () => Promise<string>
    setServerUrl: (url: string) => Promise<void>
    healthCheck: () => Promise<boolean>
    openExternal?: (url: string) => Promise<void>
  }
}
