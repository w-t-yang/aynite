import { cpSync, existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const isDev = process.env.VITE_VIEWS_DEV === 'true'
const ayniteDir = resolve(homedir(), '.aynite')

/**
 * Copies config.json from each view's source directory into the build output.
 * This ensures view configs ship together with the built views.
 */
function copyViewConfigs(): Plugin {
  const viewsSrcDir = resolve(__dirname, 'src/renderer/views')
  return {
    name: 'copy-view-configs',
    closeBundle() {
      const outDir = resolve(__dirname, isDev ? ayniteDir : 'dist-views')
      const viewsOutDir = join(outDir, 'views')

      if (!existsSync(viewsSrcDir)) return

      const entries = readdirSync(viewsSrcDir, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const srcConfig = join(viewsSrcDir, entry.name, 'config.json')
        if (!existsSync(srcConfig)) continue

        const destDir = join(viewsOutDir, entry.name)
        const destConfig = join(destDir, 'config.json')
        cpSync(srcConfig, destConfig)
      }
    },
  }
}

export default defineConfig({
  root: 'src/renderer',
  base: './', // Use relative paths for file:// protocol
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src'),
    },
  },
  plugins: [react(), tailwindcss(), copyViewConfigs()],
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
        'views/workspace-view/index': resolve(
          __dirname,
          'src/renderer/views/workspace-view/index.html',
        ),
        'views/ai-browser/index': resolve(
          __dirname,
          'src/renderer/views/ai-browser/index.html',
        ),
        'views/dataview-stock/index': resolve(
          __dirname,
          'src/renderer/views/dataview-stock/index.html',
        ),
        'views/dataview-chart/index': resolve(
          __dirname,
          'src/renderer/views/dataview-chart/index.html',
        ),
        'views/dataview-graph/index': resolve(
          __dirname,
          'src/renderer/views/dataview-graph/index.html',
        ),
        'views/dataview-mindmap/index': resolve(
          __dirname,
          'src/renderer/views/dataview-mindmap/index.html',
        ),
        'views/dataview-flow/index': resolve(
          __dirname,
          'src/renderer/views/dataview-flow/index.html',
        ),
        'views/dataview-theme/index': resolve(
          __dirname,
          'src/renderer/views/dataview-theme/index.html',
        ),
        'views/dataview-diagram/index': resolve(
          __dirname,
          'src/renderer/views/dataview-diagram/index.html',
        ),
        'views/rss/index': resolve(
          __dirname,
          'src/renderer/views/rss/index.html',
        ),
        'views/spotify/index': resolve(
          __dirname,
          'src/renderer/views/spotify/index.html',
        ),
        'views/dataview-canvas/index': resolve(
          __dirname,
          'src/renderer/views/dataview-canvas/index.html',
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
