/// <reference types="vitest/config" />
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const rootManifest = resolve('../package.json')
const releaseVersion = process.env.APP_VERSION || (existsSync(rootManifest) ? JSON.parse(readFileSync(rootManifest, 'utf8')).version : 'dev')

export default defineConfig({
  root: 'src',
  plugins: [react(), tailwindcss()],
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
    emptyOutDir: true
  },
  test: {
    environment: 'jsdom',
    include: ['**/*.test.{ts,tsx}'],
    setupFiles: ['./test-setup.ts'],
  }
})
