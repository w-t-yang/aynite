import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

const isDev = process.env.VITE_VIEWS_DEV === 'true'

export default defineConfig({
  root: 'src/renderer',
  base: './', // Use relative paths for file:// protocol
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src'),
    },
  },
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../../dist-views',
    emptyOutDir: true,
    minify: isDev ? false : 'esbuild',
    sourcemap: isDev,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: {
        'views/settings/index': resolve(
          __dirname,
          'src/renderer/views/settings/index.html',
        ),
        'views/treeview/index': resolve(
          __dirname,
          'src/renderer/views/treeview/index.html',
        ),
        'views/aichat/index': resolve(
          __dirname,
          'src/renderer/views/aichat/index.html',
        ),
      },
      output: {
        entryFileNames: isDev ? 'assets/[name].js' : 'assets/[name]-[hash].js',
        chunkFileNames: isDev ? 'assets/[name].js' : 'assets/[name]-[hash].js',
        assetFileNames: isDev ? 'assets/[name].[ext]' : 'assets/[name]-[hash].[ext]',
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor'
          }
        },
      },
    },
  },
})
