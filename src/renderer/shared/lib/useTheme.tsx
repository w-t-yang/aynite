import React, { useEffect, useCallback } from 'react'
import { applyThemeColors, Theme } from './utils'

/**
 * Hook for iframe views to self-apply the active theme.
 * Loads the theme on mount and listens for theme changes via IPC.
 * Theme is applied fire-and-forget — CSS defaults cover the initial render.
 */
export function useViewTheme() {
  const loadTheme = useCallback(async (themeId?: string) => {
    const w = window as any
    if (!w.aynite) return

    try {
      const id = themeId || (await w.aynite.getConfig('activeTheme'))
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

    const w = window as any
    if (w.aynite?.onThemeChanged) {
      const unsub = w.aynite.onThemeChanged((newId: string) => {
        loadTheme(newId)
      })
      return () => unsub()
    }
  }, [loadTheme])
}

/**
 * Wrapper component that applies the active theme to child content.
 * Use in view entry points (aichat, settings, treeview) so they self-apply themes.
 */
export function ThemeAwareView({ children }: { children: React.ReactNode }) {
  useViewTheme()
  return <>{children}</>
}
