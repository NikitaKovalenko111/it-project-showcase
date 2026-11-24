import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    plugins: [react()],
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:3005',
          changeOrigin: true,
          configure(proxy) {
            proxy.on('proxyReq', (outgoing, incoming) => {
              const host = incoming.headers.host
              // The dev server uses HTTP. Retain Origin for cross-origin requests.
              if (host && incoming.headers.origin === `http://${host}`) {
                outgoing.removeHeader('origin')
              }
            })
          },
        },
      },
    },
  }
})
