import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_API_BASE_URL || 'http://localhost:4001',
          changeOrigin: true,
          secure: false,
          timeout: 240000,
          proxyTimeout: 240000
        },
        '/health': {
          target: env.VITE_API_BASE_URL || 'http://localhost:4001',
          changeOrigin: true,
          secure: false
        }
      }
    },
    // Target modern browsers — avoids legacy polyfills in output
    build: {
      outDir: 'dist',
      sourcemap: false,
      target: ['es2020', 'chrome80', 'firefox79', 'safari14'],
      // Skip the ~2 kB modulepreload polyfill (not needed for modern browsers)
      modulePreload: { polyfill: false },
      rollupOptions: {
        output: {
          manualChunks(id) {
            // PDF / canvas + ALL transitive deps — only loaded on print pages
            if (
              id.includes('jspdf') ||
              id.includes('html2canvas') ||
              id.includes('/fflate/') ||
              id.includes('/fast-png/') ||
              id.includes('/css-line-break/') ||
              id.includes('/text-segmentation/') ||
              id.includes('/canvg/') ||
              id.includes('/rgbcolor/') ||
              id.includes('/stackblur-canvas/') ||
              id.includes('/svg-pathdata/')
            ) {
              return 'vendor-pdf'
            }
            // Date picker libs
            if (
              id.includes('react-date-object') ||
              id.includes('react-multi-date-picker') ||
              id.includes('date-fns')
            ) {
              return 'vendor-date'
            }
            // UI utilities — only loaded by specific admin/print pages
            if (
              id.includes('@fortawesome') ||
              id.includes('react-toastify') ||
              id.includes('qrcode')
            ) {
              return 'vendor-ui'
            }
            // React core — keep together for best long-term caching
            if (
              id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/scheduler/')
            ) {
              return 'vendor-react'
            }
            // Router
            if (
              id.includes('react-router-dom') ||
              id.includes('react-router/') ||
              id.includes('@remix-run/router')
            ) {
              return 'vendor-router'
            }
            // Everything else (axios, @babel/runtime helpers, etc.)
            if (id.includes('node_modules/')) {
              return 'vendor-misc'
            }
          }
        }
      }
    },
    // Drop console/debugger from production builds
    esbuild: {
      drop: mode === 'production' ? ['console', 'debugger'] : []
    }
  }
})
