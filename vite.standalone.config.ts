import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  root: 'src/renderer',
  base: './', // Use relative paths for file:// protocol
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src')
    }
  },
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../../dist-standalones',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        'views/settings/index': resolve(__dirname, 'src/renderer/views/settings/index.html')
      }
    }
  }
})
