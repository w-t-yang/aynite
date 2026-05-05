import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    coverage: {
      include: ['src/lib/**', 'src/main/**'],
      exclude: ['src/main/**/index.ts', 'src/main/**/ipc.ts'],
    },
  },
})
