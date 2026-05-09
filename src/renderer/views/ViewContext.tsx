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

/**
 * Standardized hook for Views to listen to relayed system events.
 */
export const useAppEvent = (
  type: string,
  callback: (data: any) => void,
  deps: any[] = [],
) => {
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data
      if (message?.type === `aynite:${type}`) {
        callback(message.data)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [type, ...deps, callback])
}

/**
 * Hook that returns a subscription function for relayed system events.
 * Useful for non-React code (like agent loops) that need to manage listeners.
 */
export const useAppEventSubscriber = () => {
  return useCallback((callback: (event: any) => void) => {
    const handler = (e: MessageEvent) => {
      const msg = e.data
      if (msg?.type?.startsWith('aynite:')) {
        callback({ type: msg.type.replace('aynite:', ''), data: msg.data })
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])
}

/**
 * Hook to trigger a global app operation from a view.
 */
export const useAppOperation = () => {
  return useCallback((operation: string, data?: unknown) => {
    const w = window as any
    if (w.aynite?.executeAppOperation) {
      w.aynite.executeAppOperation(operation, data)
    }
  }, [])
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
      const themesList = await w.aynite.getThemes()
      if (themesList) setThemes(themesList)
    } catch (e) {
      console.error('[ViewContext] Failed to load theme:', e)
    }
  }, [])

  useEffect(() => {
    loadTheme()
  }, [loadTheme])

  // Listen for relayed theme changes
  useAppEvent('theme-changed', () => {
    loadTheme()
  })

  const setTheme = useCallback(
    async (id: string) => {
      await window.aynite.setConfig('activeTheme', id)
      await loadTheme(id)
    },
    [loadTheme],
  )

  // Report clicks to parent for tile activation
  useEffect(() => {
    const w = window as any
    if (!w.aynite) return

    // Extract tileId from hash (e.g. #tileId=...)
    const hash = window.location.hash
    const match = hash.match(/tileId=([^&]+)/)
    const tileId = match ? match[1] : null

    if (!tileId) return

    const handleMouseDown = () => {
      w.aynite.activateTile(tileId)
    }
    window.addEventListener('mousedown', handleMouseDown, true)
    return () => window.removeEventListener('mousedown', handleMouseDown, true)
  }, [])

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
