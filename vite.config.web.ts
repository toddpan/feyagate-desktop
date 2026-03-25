import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist-web',
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    proxy: {
      '/mcp': {
        target: 'http://localhost:38080',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:38080',
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
