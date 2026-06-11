/**
 * Barrel — re-exports everything from resolve.ts, operations.ts, and platform.ts.
 *
 * All consumers import from 'src/lib/path' and get the same exports
 * as the old monolithic src/lib/path.ts. No import changes needed.
 *
 * Cross-platform utilities (toUnixPath, normalizePath, IS_WINDOWS, etc.)
 * are re-exported from platform.ts, which is safe to import from all
 * processes (main, preload, renderer, tests).
 */

// Explicitly re-export platform utilities to avoid Vite tree-shaking issues
// with nested `export *` chains that may produce undefined values.
// Re-export toUnixPath as normalizePath for renderer backward compatibility
export {
  getLastSegment,
  getParentDir,
  getPathSeparator,
  IS_LINUX,
  IS_MAC,
  IS_WINDOWS,
  joinUnixPaths,
  normalizeForComparison,
  splitPath,
  toUnixPath,
  toUnixPath as normalizePath,
} from '../platform'
export * from './operations'
export * from './resolve'
