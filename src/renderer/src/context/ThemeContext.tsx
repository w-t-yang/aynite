import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode
} from 'react'
import { WorkspaceConfig, KeybindingConfig, View, Theme } from '../../../lib/constants/types'
import { ConfigKey } from '../../../lib/constants/config'
import { ayniteConfig } from '../config'
import { applyThemeColors as applySharedThemeColors } from '../../shared/lib/utils'

interface ThemeContextType {
  activeTheme: Theme | null
  themes: Theme[]
  setTheme: (themeId: string) => Promise<void>
  loadThemes: () => Promise<void>
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
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
  }, [loadThemes])



  // Expose theme context to window for debugging in development
  useEffect(() => {
    if (import.meta.env.DEV) {
      ;(window as any).__aynite_theme = {
        activeTheme,
        themes,
        setTheme,
        loadThemes
      }
    }
  }, [activeTheme, themes, setTheme, loadThemes])


  return (
    <ThemeContext.Provider value={{ activeTheme, themes, setTheme, loadThemes }}>
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
