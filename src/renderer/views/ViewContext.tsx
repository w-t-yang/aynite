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
import { config, configMutations } from '../bridge/config'
import { events, systemMutations } from '../bridge/index'
import { theme as bridgeTheme } from '../bridge/theme'
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
 * Hook to trigger a global app operation from a view.
 */
export const useAppOperation = () => {
  return useCallback((operation: string, data?: unknown) => {
    events.execute(operation, data)
  }, [])
}

/**
 * @deprecated Views should not listen to events directly.
 * Will be removed once all views are migrated to consume state from ViewContext.
 * Use useAppEvent for now during migration — it listens to relayed postMessage events.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, ...deps, callback])
}

/**
 * @deprecated Views should not listen to events directly.
 * Will be removed once all views are migrated to consume state from ViewContext.
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

// ─── View Provider ─────────────────────────────────────────────────────────

/**
 * Unified Provider for micro-app views.
 * Handles theme application.
 * Has a single postMessage listener for relayed events.
 */
export const ViewProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [themes, setThemes] = useState<Theme[]>([])
  const [activeThemeId, setActiveThemeId] = useState<string>('')

  const loadTheme = useCallback(async (themeId?: string) => {
    try {
      const id = themeId || (await config.get('activeTheme'))
      setActiveThemeId(id)

      const themeData = await bridgeTheme.get(id)
      if (themeData) {
        applyThemeColors(themeData as Theme)
      }

      // Also load theme list
      const themesList = await config.get('themes')
      if (themesList) setThemes(themesList)
    } catch (e) {
      console.error('[ViewContext] Failed to load theme:', e)
    }
  }, [])

  useEffect(() => {
    loadTheme()
  }, [loadTheme])

  // Listen for relayed theme changes via single message listener
  // (This is the ONE allowed postMessage listener per the architecture)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data
      if (message?.type === 'aynite:theme-changed') {
        loadTheme()
      }
      if (message?.type === 'aynite:refresh-tile') {
        window.location.reload()
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [loadTheme])

  const setTheme = useCallback(async (id: string) => {
    await configMutations.set('activeTheme', id)
    // Don't call loadTheme here — event loop will bring the new theme
  }, [])

  // Report clicks to parent for tile activation
  useEffect(() => {
    // Extract tileId from hash (e.g. #tileId=...)
    const hash = window.location.hash
    const match = hash.match(/tileId=([^&]+)/)
    const tileId = match ? match[1] : null

    if (!tileId) return

    const handleMouseDown = () => {
      systemMutations.activateTile(tileId)
    }
    window.addEventListener('mousedown', handleMouseDown, true)

    return () => {
      window.removeEventListener('mousedown', handleMouseDown, true)
    }
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
