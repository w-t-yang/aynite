import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Default to node for backend tests, individual files can use
    // `// @vitest-environment jsdom` for renderer tests
    environment: 'node',
    coverage: {
      include: ['src/lib/**', 'src/main/**', 'src/renderer/shared/**', 'src/renderer/views/**'],
      exclude: [
        // Entry points — pure React mounts, nothing to test
        'src/main/**/index.ts',
        'src/main/**/ipc.ts',
        'src/renderer/views/**/*-main.tsx',
        'src/renderer/views/**/*-main.ts',
        // Pure type definitions — no runtime code
        'src/lib/types/**/*.ts',
        'src/lib/constants/types.ts',
        'src/renderer/shared/lib/types.ts',
        'src/renderer/views/**/types.ts',
        'src/renderer/views/**/types/*.ts',
        // Config / i18n data files
        'src/renderer/views/**/config.json',
        'src/renderer/views/**/*.json',
        // Barrel exports
        'src/renderer/views/**/components/index.ts',
        // Documentation
        '**/*.deps.md',
        '**/*.md',
      ],
    },
  },
})
