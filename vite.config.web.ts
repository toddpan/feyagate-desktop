import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const MCP_SERVER = process.env.MCP_SERVER || 'http://localhost:38080'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist-web',
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    host: true,
    proxy: {
      '/mcp': {
        target: MCP_SERVER,
        changeOrigin: true,
      },
      '/api': {
        target: MCP_SERVER,
        changeOrigin: true,
      },
      '/health': {
        target: MCP_SERVER,
        changeOrigin: true,
      },
      '/auth': {
        target: MCP_SERVER,
        changeOrigin: true,
      },
      '/ota': {
        target: 'https://your-ota-server.example.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
