import { homedir } from 'node:os'
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const isDev = process.env.VITE_VIEWS_DEV === 'true'
const ayniteDir = resolve(homedir(), '.aynite')

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
    outDir: isDev ? ayniteDir : '../../dist-views',
    emptyOutDir: !isDev,
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
        'views/mindmap/index': resolve(
          __dirname,
          'src/renderer/views/mindmap/index.html',
        ),
        'views/flow/index': resolve(
          __dirname,
          'src/renderer/views/flow/index.html',
        ),
        'views/theme-studio/index': resolve(
          __dirname,
          'src/renderer/views/theme-studio/index.html',
        ),
        'views/diagram/index': resolve(
          __dirname,
          'src/renderer/views/diagram/index.html',
        ),
        'views/rss/index': resolve(
          __dirname,
          'src/renderer/views/rss/index.html',
        ),
        'views/spotify/index': resolve(
          __dirname,
          'src/renderer/views/spotify/index.html',
        ),
        'views/canvas/index': resolve(
          __dirname,
          'src/renderer/views/canvas/index.html',
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
