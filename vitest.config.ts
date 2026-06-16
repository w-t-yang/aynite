import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Default to node for backend tests, individual files can use
    // `// @vitest-environment jsdom` for renderer tests
    environment: 'node',
    coverage: {
      include: ['src/lib/**', 'src/main/**', 'src/renderer/shared/**'],
      exclude: [
        'src/main/**/index.ts',
        'src/main/**/ipc.ts',
        '**/*.deps.md',
        '**/*.md',
      ],
    },
  },
})
