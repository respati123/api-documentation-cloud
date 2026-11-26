import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
export default defineConfig({
 plugins: [react(), tailwindcss()],
 resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
 server: { host: '127.0.0.1', port: 5176, strictPort: true, proxy: {
 '/api': { target: 'http://localhost:3001', changeOrigin: false, ws: true },
 '/health': { target: 'http://localhost:3001', changeOrigin: false }
 } }
})
