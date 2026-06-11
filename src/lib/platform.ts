/**
 * Cross-Platform Utilities
 *
 * Pure functions for platform detection and path normalization.
 * Safe to import from ANY process (main, preload, renderer, tests):
 * - No Electron imports
 * - No Node.js internal module imports (only `process` which is polyfilled
 *   by Vite/Rolldown in the renderer)
 * - Only string manipulation and simple checks
 */

// ─── Platform Detection ─────────────────────────────────────────────────

/** Internal function to safely get the platform string */
function getPlatform(): string {
  try {
    return typeof process !== 'undefined' ? process.platform : ''
  } catch {
    return ''
  }
}

const _platform: string = getPlatform()
export const IS_WINDOWS: boolean = _platform === 'win32'
export const IS_MAC: boolean = _platform === 'darwin'
export const IS_LINUX: boolean = _platform === 'linux'

// ─── Path Normalization ─────────────────────────────────────────────────

/**
 * Convert backslashes to forward slashes.
 * On Windows, Node.js paths use `\` but many consumers (git, file:// URLs,
 * hash fragment paths) expect `/`. On macOS/Linux this is a no-op.
 *
 * Use this for:
 * - Path comparisons (normalize both sides)
 * - Passing paths to git commands
 * - Building file:// URLs
 * - Storing paths in hash fragments
 */
export function toUnixPath(p: string): string {
  return p.replace(/\\/g, '/')
}

/**
 * Normalize a path for comparison: convert `\` to `/` AND lowercase.
 * Use this for case-insensitive path matching on Windows.
 * On macOS/Linux, case-preserving but separator-normalized.
 */
export function normalizeForComparison(p: string): string {
  const unix = toUnixPath(p)
  return IS_WINDOWS ? unix.toLowerCase() : unix
}

// ─── Path Segment Operations ────────────────────────────────────────────

/**
 * Split a path on EITHER forward or back slash.
 * Unlike `String.prototype.split('/')`, this works with Windows `\` paths too.
 */
export function splitPath(p: string): string[] {
  return p.split(/[/\\]/)
}

/**
 * Join path segments with forward slashes.
 * This is for DISPLAY / COMPARISON purposes, NOT for filesystem operations.
 * For filesystem operations, use `path.join()` from `src/lib/path/resolve.ts`.
 */
export function joinUnixPaths(...parts: string[]): string {
  return parts
    .map((part) => toUnixPath(part))
    .join('/')
    .replace(/\/+/g, '/')
}

/**
 * Get the last segment (filename or directory name) from a path.
 * Works with both `/` and `\` separators.
 */
export function getLastSegment(p: string): string {
  const normalized = toUnixPath(p)
  const idx = normalized.lastIndexOf('/')
  return idx >= 0 ? normalized.slice(idx + 1) : normalized
}

/**
 * Get the parent directory path. Works with both `/` and `\` separators.
 * Returns '.' if there is no parent (single-segment path).
 */
export function getParentDir(p: string): string {
  const normalized = toUnixPath(p)
  const idx = normalized.lastIndexOf('/')
  if (idx <= 0) return idx === 0 ? '/' : '.'
  return normalized.slice(0, idx)
}

/**
 * Get the platform-aware path separator character.
 */
export function getPathSeparator(): '/' | '\\' {
  return IS_WINDOWS ? '\\' : '/'
}
