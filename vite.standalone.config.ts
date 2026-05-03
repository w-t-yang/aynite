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
    outDir: '../../dist-standalone',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: {
        'views/settings/index': resolve(__dirname, 'src/renderer/views/settings/index.html'),
        'views/treeview/index': resolve(__dirname, 'src/renderer/views/treeview/index.html'),
        'views/aichat/index': resolve(__dirname, 'src/renderer/views/aichat/index.html')
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@tiptap') || id.includes('prosemirror')) return 'vendor-editor';
            if (id.includes('react-markdown') || id.includes('remark') || id.includes('micromark') || id.includes('prismjs')) return 'vendor-markdown';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler')) return 'vendor-react';
            return 'vendor';
          }
          if (id.includes('src/renderer/shared')) {
            return 'shared';
          }
        }
      }
    }
  }
})
