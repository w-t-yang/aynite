import { AlertCircle, Download, RefreshCw, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { AppEvents } from '../../../lib/constants/app'
import { FLEX_CENTER_GAP_3 } from '../../../lib/constants/renderer/styles'
import { cn } from '../../shared/lib/utils'
import { useApp } from '../../src/context/AppContext'

export function UpdateNotification() {
  const [updateStatus, setUpdateStatus] = useState<
    'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error'
  >('idle')
  const [updateInfo, setUpdateInfo] = useState<any>(null)
  const [updateProgress, setUpdateProgress] = useState<number>(0)
  const [updateError, setUpdateError] = useState<string | null>(null)

  const { subscribeToAppEvents } = useApp()

  useEffect(() => {
    if (!window.aynite) return

    return subscribeToAppEvents((event: { type: string; data: any }) => {
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
    })
  }, [subscribeToAppEvents])

  useEffect(() => {
    if (updateStatus === 'error') {
      const timer = setTimeout(() => {
        setUpdateStatus('idle')
        setUpdateError(null)
      }, 8000) // Auto-close error after 8 seconds
      return () => clearTimeout(timer)
    }
    return undefined
  }, [updateStatus])

  if (updateStatus === 'idle') return null

  const isError = updateStatus === 'error'

  return (
    <div className="fixed bottom-4 right-4 z-[4000] animate-in slide-in-from-bottom-2 fade-in">
      <div
        className={cn(
          'bg-popover border border-border shadow-2xl rounded-xl p-4 min-w-[320px] max-w-md flex flex-col gap-3 transition-all duration-300',
          isError && 'border-destructive/50',
        )}
      >
        {/* Header Row: Icon, Title, Close Button */}
        <div className={FLEX_CENTER_GAP_3}>
          <div
            className={cn(
              'p-2 rounded-lg shrink-0',
              isError
                ? 'bg-destructive/10 text-destructive'
                : 'bg-primary/10 text-primary',
            )}
          >
            {updateStatus === 'checking' && (
              <RefreshCw size={18} className="animate-spin" />
            )}
            {updateStatus === 'available' && <Download size={18} />}
            {updateStatus === 'downloading' && (
              <Download size={18} className="animate-bounce" />
            )}
            {updateStatus === 'downloaded' && <Download size={18} />}
            {updateStatus === 'error' && <AlertCircle size={18} />}
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-foreground truncate">
              {updateStatus === 'checking' && 'Checking for updates...'}
              {updateStatus === 'available' &&
                `Update available: v${updateInfo?.version}`}
              {updateStatus === 'downloading' &&
                `Downloading update... ${Math.round(updateProgress)}%`}
              {updateStatus === 'downloaded' &&
                `Update v${updateInfo?.version} ready`}
              {updateStatus === 'error' && 'Update Failed'}
            </h4>
          </div>

          <button
            type="button"
            onClick={() => {
              setUpdateStatus('idle')
              setUpdateError(null)
            }}
            className="p-1 hover:bg-accent rounded-md text-muted-foreground transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Area: Simplified Error or Status */}
        {isError ? (
          <div className="bg-destructive/5 rounded-lg p-2 max-h-[120px] overflow-auto scrollbar-thin">
            <p className="text-xs text-destructive/90 break-words whitespace-pre-wrap font-mono leading-relaxed">
              {updateError?.split('\n').slice(0, 3).join('\n') ||
                'Unknown error occurred during update.'}
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground truncate px-1">
            {updateStatus === 'downloaded'
              ? 'Restart to apply changes'
              : 'Aynite Release Pipeline'}
          </p>
        )}

        {/* Progress / Actions */}
        {updateStatus === 'downloading' && (
          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden mt-1">
            <div
              className="bg-primary h-full transition-all duration-300"
              style={{ width: `${updateProgress}%` }}
            />
          </div>
        )}

        {updateStatus === 'downloaded' && (
          <button
            type="button"
            onClick={() => window.aynite.installUpdate()}
            className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 mt-1"
          >
            <RefreshCw size={14} /> Restart and Update
          </button>
        )}
      </div>
    </div>
  )
}
