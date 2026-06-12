import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import type { WindowActions } from '../../../lib/types/window'

interface WindowContextType {
  isMaximized: boolean
  isFullscreen: boolean
  /** Exposed so AppContext single router can call event-driven updates */
  actionsRef: React.MutableRefObject<WindowActions | null>
}

const WindowContext = createContext<WindowContextType | undefined>(undefined)

export const WindowProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [isMaximized, setIsMaximized] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const actionsRef = useRef<WindowActions | null>(null)

  // Keep actions ref in sync
  useEffect(() => {
    actionsRef.current = {
      setMaximized: (val) => setIsMaximized(val),
      setFullscreen: (val) => setIsFullscreen(val),
    }
  }, [])

  return (
    <WindowContext.Provider value={{ isMaximized, isFullscreen, actionsRef }}>
      {children}
    </WindowContext.Provider>
  )
}

export const useWindowState = () => {
  const context = useContext(WindowContext)
  if (!context) {
    throw new Error('useWindowState must be used within a WindowProvider')
  }
  return context
}
