import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import { AppEvents } from '../../../lib/constants/app'
import type { Theme } from '../../../lib/constants/types'
import { config, configMutations } from '../../bridge/config'
import { events } from '../../bridge/events'
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
    try {
      const loadedThemes = await config.get('themes')
      setThemes(loadedThemes || [])

      const themeId = await config.get('activeTheme')
      const theme = await config.getWithPayload('theme', themeId)

      if (theme) {
        setActiveTheme(theme)
      }
    } catch (e) {
      console.error('[ThemeContext] Failed to refresh themes:', e)
    }
  }, [])

  const setTheme = useCallback(async (themeId: string) => {
    await configMutations.set('activeTheme', themeId)
    // Don't call refreshThemes here — THEME_CHANGED event will trigger it
  }, [])

  // IPC: theme changes from other windows
  // Note: Will be centralized in AppContext in future phase
  useEffect(() => {
    const unbind = events.onAppEvent((event: { type: string }) => {
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
