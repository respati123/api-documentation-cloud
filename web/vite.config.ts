/// <reference types="vitest/config" />
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer'

const rootManifest = resolve('../package.json')
const releaseVersion = process.env.APP_VERSION || (existsSync(rootManifest) ? JSON.parse(readFileSync(rootManifest, 'utf8')).version : 'dev')

// Library code changes less often than app code, so each group gets its own file and stays cached across releases.
function vendorChunk(id: string): string | undefined {
  if (!id.includes('node_modules')) return undefined
  if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'vendor-react'
  if (id.includes('/@tanstack/')) return 'vendor-query'
  if (id.includes('/i18next') || id.includes('/react-i18next/')) return 'vendor-i18n'
  if (id.includes('/@base-ui/') || id.includes('/@floating-ui/')) return 'vendor-ui'
  return undefined
}

export default defineConfig({
  root: 'src',
  plugins: [react(), tailwindcss(), ...(process.env.ANALYZE ? [visualizer({ filename: process.env.ANALYZE, template: 'raw-data', gzipSize: true })] : [])],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  define: {
    __APP_VERSION__: JSON.stringify(releaseVersion)
  },
  server: {
    host: '127.0.0.1',
    port: 5174,
    proxy: {
      '/api/': 'http://localhost:3001',
      '/health': 'http://localhost:3001'
    }
  },
  build: {
    outDir: resolve('dist'),
    emptyOutDir: true,
    rollupOptions: {
      output: { manualChunks: vendorChunk }
    }
  },
  test: {
    environment: 'jsdom',
    include: ['**/*.test.{ts,tsx}'],
    setupFiles: ['./test-setup.ts'],
  }
})
