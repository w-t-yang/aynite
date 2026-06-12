import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import type { Theme } from '../../../lib/constants/types'
import type { ThemeActions } from '../../../lib/types/ui'
import { config, configMutations } from '../../bridge/config'
import { applyThemeColors } from '../../shared/lib/utils'

interface ThemeContextType {
  themes: Theme[]
  activeTheme: Theme | null
  setTheme: (themeId: string) => Promise<void>
  refreshThemes: () => Promise<void>
  /** Exposed so AppContext single router can call event-driven updates */
  actionsRef: React.MutableRefObject<ThemeActions | null>
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [themes, setThemes] = useState<Theme[]>([])
  const [activeTheme, setActiveTheme] = useState<Theme | null>(null)

  const actionsRef = useRef<ThemeActions | null>(null)

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

  // Keep actions ref in sync
  useEffect(() => {
    actionsRef.current = { refreshThemes }
  }, [refreshThemes])

  const setTheme = useCallback(async (themeId: string) => {
    await configMutations.set('activeTheme', themeId)
    // Don't call refreshThemes here — THEME_CHANGED event will trigger it
  }, [])

  return (
    <ThemeContext.Provider
      value={{ themes, activeTheme, setTheme, refreshThemes, actionsRef }}
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
