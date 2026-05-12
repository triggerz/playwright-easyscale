import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    allowedHosts: [
      'localhost',
      ...(process.env.VITE_PUBLIC_URL ? [new URL(process.env.VITE_PUBLIC_URL).hostname] : [])
    ],
    proxy: {
      '/api': {
        target: process.env.ORCHESTRATOR_URL || 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path
      }
    }
  }
})
