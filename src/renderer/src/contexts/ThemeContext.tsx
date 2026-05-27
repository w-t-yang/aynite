import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import { AppEvents } from '../../../lib/constants/app'
import { ayniteConfig } from '../../../lib/constants/renderer/config'
import type { Theme } from '../../../lib/constants/types'
import { applyThemeColors } from '../../shared/lib/utils'

interface ThemeContextType {
  themes: Theme[]
  activeTheme: Theme | null
  setTheme: (themeId: string) => Promise<void>
  refreshThemes: () => Promise<void>
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [themes, setThemes] = useState<Theme[]>([])
  const [activeTheme, setActiveTheme] = useState<Theme | null>(null)

  useEffect(() => {
    if (activeTheme) {
      applyThemeColors(activeTheme)
    }
  }, [activeTheme])

  const refreshThemes = useCallback(async () => {
    const loadedThemes = await ayniteConfig.getThemes()
    setThemes(loadedThemes)

    const themeId = await ayniteConfig.getActiveThemeId()
    const theme = await ayniteConfig.getTheme(themeId)

    if (theme) {
      setActiveTheme(theme)
    }
  }, [])

  const setTheme = useCallback(
    async (themeId: string) => {
      await window.aynite.setConfig('activeTheme', themeId)
      await refreshThemes()
    },
    [refreshThemes],
  )

  // IPC: theme changes from other windows
  useEffect(() => {
    if (!window.aynite) return
    const unbind = window.aynite.onAppEvent((event: { type: string }) => {
      if (event.type === AppEvents.THEME_CHANGED) {
        refreshThemes()
      }
    })
    return unbind
  }, [refreshThemes])

  return (
    <ThemeContext.Provider
      value={{ themes, activeTheme, setTheme, refreshThemes }}
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
