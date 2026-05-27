import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react'
import { AppEvents } from '../../../lib/constants/app'
import type { UpdateStatus } from '../../../lib/types/app'

interface UpdateContextType {
  updateStatus: UpdateStatus
  updateInfo: any
  updateProgress: number
  updateError: string | null
  setUpdateStatus: (status: UpdateStatus) => void
}

const UpdateContext = createContext<UpdateContextType | undefined>(undefined)

export const UpdateProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle')
  const [updateInfo, setUpdateInfo] = useState<any>(null)
  const [updateProgress, setUpdateProgress] = useState<number>(0)
  const [updateError, setUpdateError] = useState<string | null>(null)

  useEffect(() => {
    if (!window.aynite) return
    const unbind = window.aynite.onAppEvent(
      (event: { type: string; data: any }) => {
        switch (event.type) {
          case AppEvents.UPDATE_CHECKING:
            setUpdateStatus('checking')
            break
          case AppEvents.UPDATE_AVAILABLE:
            setUpdateStatus('available')
            setUpdateInfo(event.data)
            break
          case AppEvents.UPDATE_NOT_AVAILABLE:
            setUpdateStatus('idle')
            break
          case AppEvents.UPDATE_ERROR:
            setUpdateStatus('error')
            setUpdateError(event.data)
            break
          case AppEvents.UPDATE_PROGRESS:
            setUpdateStatus('downloading')
            setUpdateProgress(event.data.percent)
            break
          case AppEvents.UPDATE_DOWNLOADED:
            setUpdateStatus('downloaded')
            setUpdateInfo(event.data)
            break
        }
      },
    )
    return unbind
  }, [])

  return (
    <UpdateContext.Provider
      value={{
        updateStatus,
        updateInfo,
        updateProgress,
        updateError,
        setUpdateStatus,
      }}
    >
      {children}
    </UpdateContext.Provider>
  )
}

export const useUpdate = () => {
  const context = useContext(UpdateContext)
  if (!context) {
    throw new Error('useUpdate must be used within an UpdateProvider')
  }
  return context
}
