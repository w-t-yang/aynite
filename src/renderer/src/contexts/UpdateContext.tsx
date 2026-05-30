import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import type { UpdateStatus } from '../../../lib/types/app'
import { updateMutations } from '../../bridge/update'

export interface UpdateActions {
  setChecking: () => void
  setAvailable: (info: any) => void
  setIdle: () => void
  setError: (err: string) => void
  setDownloading: (percent: number) => void
  setDownloaded: (info: any) => void
}

interface UpdateContextType {
  updateStatus: UpdateStatus
  updateInfo: any
  updateProgress: number
  updateError: string | null
  setUpdateStatus: (status: UpdateStatus) => void
  /** Install update via bridge */
  installUpdate: () => Promise<void>
  /** Exposed so AppContext single router can call event-driven updates */
  actionsRef: React.MutableRefObject<UpdateActions | null>
}

const UpdateContext = createContext<UpdateContextType | undefined>(undefined)

export const UpdateProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle')
  const [updateInfo, setUpdateInfo] = useState<any>(null)
  const [updateProgress, setUpdateProgress] = useState<number>(0)
  const [updateError, setUpdateError] = useState<string | null>(null)

  const actionsRef = useRef<UpdateActions | null>(null)

  // Keep actions ref in sync
  useEffect(() => {
    actionsRef.current = {
      setChecking: () => {
        setUpdateStatus('checking')
      },
      setAvailable: (info) => {
        setUpdateStatus('available')
        setUpdateInfo(info)
      },
      setIdle: () => {
        setUpdateStatus('idle')
        setUpdateInfo(null)
        setUpdateProgress(0)
      },
      setError: (err) => {
        setUpdateStatus('error')
        setUpdateError(err)
      },
      setDownloading: (percent) => {
        setUpdateStatus('downloading')
        setUpdateProgress(percent)
      },
      setDownloaded: (info) => {
        setUpdateStatus('downloaded')
        setUpdateProgress(100)
        setUpdateInfo(info)
      },
    }
  }, [])

  const installUpdate = useCallback(async () => {
    await updateMutations.install()
  }, [])

  return (
    <UpdateContext.Provider
      value={{
        updateStatus,
        updateInfo,
        updateProgress,
        updateError,
        setUpdateStatus,
        installUpdate,
        actionsRef,
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
