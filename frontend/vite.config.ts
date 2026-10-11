import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), {
    name: 'omit-disabled-preview',
    apply: 'build',
    generateBundle(_, bundle) {
      if (loadEnv(mode, process.cwd(), 'VITE_').VITE_ENABLE_PREVIEW === 'true') return
      // Rolldown may emit the optional dynamic entry even after its caller is removed.
      for (const [name, output] of Object.entries(bundle)) {
        if (output.type === 'chunk' && output.facadeModuleId?.replaceAll('\\', '/').endsWith('/src/demo.ts')) delete bundle[name]
        if (output.type === 'asset' && output.originalFileNames.some(file => file.replaceAll('\\', '/').endsWith('src/demo-md-flow.svg'))) delete bundle[name]
      }
    },
  }],
  server: {
    host: '127.0.0.1',
    proxy: {
      '/api': { target: process.env.BLOG_API_TARGET || 'http://127.0.0.1:8000', changeOrigin: true },
      '/uploads': { target: process.env.BLOG_API_TARGET || 'http://127.0.0.1:8000', changeOrigin: true },
      '/health': { target: process.env.BLOG_API_TARGET || 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
}))
