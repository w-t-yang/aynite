import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

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
        'views/file-browser/index': resolve(
          __dirname,
          'src/renderer/views/file-browser/index.html',
        ),
        'views/session-view/index': resolve(
          __dirname,
          'src/renderer/views/session-view/index.html',
        ),
        'views/stockchart/index': resolve(
          __dirname,
          'src/renderer/views/stockchart/index.html',
        ),
        'views/datachart/index': resolve(
          __dirname,
          'src/renderer/views/datachart/index.html',
        ),
        'views/graph/index': resolve(
          __dirname,
          'src/renderer/views/graph/index.html',
        ),
      },
      output: {
        entryFileNames: isDev ? 'assets/[name].js' : 'assets/[name]-[hash].js',
        chunkFileNames: isDev ? 'assets/[name].js' : 'assets/[name]-[hash].js',
        assetFileNames: isDev
          ? 'assets/[name].[ext]'
          : 'assets/[name]-[hash].[ext]',
        manualChunks(id) {
          if (id.includes('node_modules') && !id.includes('prismjs')) {
            return 'vendor'
          }
        },
      },
    },
  },
})
