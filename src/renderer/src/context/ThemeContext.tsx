import type React from 'react'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import { ConfigKey } from '../../../lib/constants/config'
import type { Theme } from '../../../lib/constants/types'
import { applyThemeColors as applySharedThemeColors } from '../../shared/lib/utils'
import { ayniteConfig } from '../config'

interface ThemeContextType {
  activeTheme: Theme | null
  themes: Theme[]
  setTheme: (themeId: string) => Promise<void>
  loadThemes: () => Promise<void>
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [activeTheme, setActiveTheme] = useState<Theme | null>(null)
  const [themes, setThemes] = useState<Theme[]>([])

  const applyThemeColors = useCallback((theme: Theme) => {
    applySharedThemeColors(theme)
  }, [])

  const loadThemes = useCallback(async () => {
    const loadedThemes = await ayniteConfig.getThemes()
    setThemes(loadedThemes)

    // Get active theme from global settings
    const themeId = await ayniteConfig.getActiveThemeId()
    const theme = await ayniteConfig.getTheme(themeId)
    if (theme) {
      setActiveTheme(theme)
      applyThemeColors(theme)
    }
  }, [applyThemeColors])

  const setTheme = async (themeId: string) => {
    await window.aynite.setConfig(ConfigKey.ACTIVE_THEME, themeId)
    // Immediately reload to update local state and broadcast to all views
    await loadThemes()
  }

  useEffect(() => {
    loadThemes()

    // Listen for theme changes broadcast from any window (e.g. settings iframe)
    const w = window as any
    if (w.aynite?.onThemeChanged) {
      const unsub = w.aynite.onThemeChanged(() => {
        loadThemes()
      })
      return () => unsub()
    }
  }, [loadThemes])

  // Relay theme changes to iframe views via postMessage
  // Electron's webContents.send() does not reach subframe preloads,
  // so we use postMessage cross-frame communication instead.
  useEffect(() => {
    const iframes = document.querySelectorAll<HTMLIFrameElement>('iframe')
    for (const iframe of iframes) {
      iframe.contentWindow?.postMessage({ type: 'aynite-theme-changed' }, '*')
    }
  }, [])

  // Expose theme context to window for debugging in development
  useEffect(() => {
    if (import.meta.env.DEV) {
      ;(window as any).__aynite_theme = {
        activeTheme,
        themes,
        setTheme,
        loadThemes,
      }
    }
    // biome-ignore lint/correctness/useExhaustiveDependencies: dev-only debug hook
  }, [activeTheme, themes, setTheme, loadThemes])

  return (
    <ThemeContext.Provider
      value={{ activeTheme, themes, setTheme, loadThemes }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
