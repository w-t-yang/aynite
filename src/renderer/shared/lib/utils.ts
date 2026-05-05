import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function toCSSVar(key: string): string {
  return '--' + key.replace(/([A-Z])/g, '-$1').toLowerCase()
}

export interface Theme {
  id: string
  name: string
  type: 'light' | 'dark'
  colors: Record<string, string>
  fonts?: {
    fontFamily?: string
    fontMono?: string
    fontSize?: string
  }
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
    if (theme.fonts.fontFamily) root.style.setProperty('--font-sans', theme.fonts.fontFamily)
    if (theme.fonts.fontMono) root.style.setProperty('--font-mono', theme.fonts.fontMono)
    if (theme.fonts.fontSize) {
      root.style.setProperty('--font-size-base', theme.fonts.fontSize)
      root.style.fontSize = theme.fonts.fontSize
    }
  }

  // Set data attribute for CSS selectors
  root.setAttribute('data-theme', theme.type)
}
