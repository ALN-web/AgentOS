import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// /api is proxied to the local AgentOS backend (Live Mode development only).
// The public Demo build never calls it: see src/live/config.js.
const backend = { '/api': { target: 'http://127.0.0.1:8000', changeOrigin: false } }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    proxy: backend,
  },
  preview: {
    proxy: backend,
  },
})
