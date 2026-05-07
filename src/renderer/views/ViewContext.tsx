import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import ReactDOM from 'react-dom/client'
import { VIEW_CONTAINER } from '../../lib/constants/renderer/styles'
import type { Theme } from '../../lib/constants/types'
import { applyThemeColors } from '../shared/lib/utils'
import '../shared/styles/index.css'

// ─── View Context ──────────────────────────────────────────────────────────

interface ViewContextType {
  themes: Theme[]
  activeThemeId: string
  setTheme: (themeId: string) => Promise<void>
}

const ViewContext = createContext<ViewContextType | undefined>(undefined)

/**
 * Hook to access the ViewContext.
 */
export const useView = () => {
  const context = useContext(ViewContext)
  if (!context) {
    throw new Error('useView must be used within a ViewProvider')
  }
  return context
}

// ─── View Provider ─────────────────────────────────────────────────────────

/**
 * Unified Provider for micro-app views.
 * Handles theme application.
 */
export const ViewProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [themes, setThemes] = useState<Theme[]>([])
  const [activeThemeId, setActiveThemeId] = useState<string>('')

  const loadTheme = useCallback(async (themeId?: string) => {
    const w = window as any
    if (!w.aynite) return

    try {
      const id = themeId || (await w.aynite.getConfig('activeTheme'))
      setActiveThemeId(id)

      const themeData = await w.aynite.getTheme(id)
      if (themeData) {
        applyThemeColors(themeData as Theme)
      }

      // Also load theme list
      const themeList = await w.aynite.getConfig('themes')
      if (themeList) setThemes(themeList)
    } catch (e) {
      console.error('[ViewContext] Failed to load theme:', e)
    }
  }, [])

  useEffect(() => {
    loadTheme()
  }, [loadTheme])

  const setTheme = useCallback(
    async (id: string) => {
      await window.aynite.setConfig('activeTheme', id)
      await loadTheme(id)
    },
    [loadTheme],
  )

  return (
    <ViewContext.Provider value={{ themes, activeThemeId, setTheme }}>
      <div className={VIEW_CONTAINER}>{children}</div>
    </ViewContext.Provider>
  )
}

// ─── Rendering Helper ───────────────────────────────────────────────────────

/**
 * Standard entry point renderer for micro-app views.
 * Wraps the component with ViewProvider and React.StrictMode.
 */
export function renderView(Component: React.ComponentType) {
  const container = document.getElementById('root')
  if (!container) return

  ReactDOM.createRoot(container).render(
    <React.StrictMode>
      <ViewProvider>
        <Component />
      </ViewProvider>
    </React.StrictMode>,
  )
}
