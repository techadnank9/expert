import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // Bridge (Bun, :8788). Proxying avoids CORS in dev; VITE_BRIDGE_URL overrides.
    proxy: { '/api': { target: process.env.BRIDGE_URL ?? 'http://localhost:8788', changeOrigin: true } },
  },
})
