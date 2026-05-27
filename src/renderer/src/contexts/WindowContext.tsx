import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react'
import { AppEvents } from '../../../lib/constants/app'

interface WindowContextType {
  isMaximized: boolean
  isFullscreen: boolean
}

const WindowContext = createContext<WindowContextType | undefined>(undefined)

export const WindowProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [isMaximized, setIsMaximized] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    if (!window.aynite) return
    const unbind = window.aynite.onAppEvent(
      (event: { type: string; data: any }) => {
        switch (event.type) {
          case AppEvents.WINDOW_MAXIMIZED_CHANGED:
            setIsMaximized((event.data as any)?.isMaximized ?? false)
            break
          case AppEvents.FULLSCREEN_CHANGED:
            setIsFullscreen((event.data as any)?.isFullscreen ?? false)
            break
        }
      },
    )
    return unbind
  }, [])

  return (
    <WindowContext.Provider value={{ isMaximized, isFullscreen }}>
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
