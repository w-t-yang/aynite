import type React from 'react'
import { useCallback, useEffect } from 'react'
import type { Theme } from '../../../lib/constants/types'
import { useAppEvent } from './appEvents'
import { applyThemeColors } from './utils'

/**
 * Hook for iframe views to self-apply the active theme.
 * Loads the theme on mount and listens for theme changes via
 * the unified app event channel (relayed from the main renderer).
 */
export function useViewTheme() {
  const loadTheme = useCallback(async (_data?: unknown) => {
    const w = window as any
    if (!w.aynite) return

    try {
      const id = await w.aynite.getConfig('activeTheme')
      const themeData = await w.aynite.getConfig('theme', id)
      if (themeData) {
        applyThemeColors(themeData as Theme)
      }
    } catch (e) {
      console.error('[useTheme] Failed to load theme:', e)
    }
  }, [])

  useEffect(() => {
    loadTheme()
  }, [loadTheme])

  useAppEvent('theme-changed', loadTheme)
}

/**
 * Wrapper component that applies the active theme to child content.
 * Use in view entry points (aichat, settings, treeview) so they self-apply themes.
 */
export function ThemeAwareView({ children }: { children: React.ReactNode }) {
  useViewTheme()
  return <>{children}</>
}
