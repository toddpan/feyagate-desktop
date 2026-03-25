import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
      {
        entry: 'electron/preload.ts',
        onstart(args) {
          args.reload()
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  build: {
    outDir: 'dist',
  },
  server: {
    port: 5173,
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
