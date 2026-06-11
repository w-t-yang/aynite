import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Theme } from '../../../lib/constants/types'
import { toUnixPath } from '../../../lib/platform'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function toCSSVar(key: string): string {
  return `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`
}

/**
 * Normalize path separators to forward slashes for consistent comparison.
 * On Windows, Node.js paths use backslashes but git output and some
 * IPC channels may use forward slashes. Normalizing avoids mismatches.
 * On macOS/Linux, this is a no-op since paths already use forward slashes.
 *
 * Delegates to the shared `toUnixPath()` from `src/lib/platform.ts` to
 * ensure consistent behavior across all processes (main, preload, renderer).
 */
export function normalizePath(p: string): string {
  return toUnixPath(p)
}

/**
 * Apply theme colors as CSS custom properties on document.documentElement.
 * Shared between the main renderer (ThemeContext) and iframe views.
 */
export function applyThemeColors(theme: Theme) {
  const root = document.documentElement
  for (const [key, value] of Object.entries(theme.colors)) {
    root.style.setProperty(toCSSVar(key), value)
  }

  // Apply fonts
  if (theme.fonts) {
    if (theme.fonts.fontFamily)
      root.style.setProperty('--font-sans', theme.fonts.fontFamily)
    if (theme.fonts.fontMono)
      root.style.setProperty('--font-mono', theme.fonts.fontMono)
    if (theme.fonts.fontSize) {
      root.style.setProperty('--font-size-base', theme.fonts.fontSize)
      root.style.fontSize = theme.fonts.fontSize
    }
  }

  // Set data attribute for CSS selectors
  root.setAttribute('data-theme', theme.type)
}
