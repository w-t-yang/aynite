import { AlertCircle, Download, RefreshCw, X } from 'lucide-react'
import { useEffect } from 'react'
import { FLEX_CENTER_GAP_3 } from '../../../lib/constants/renderer/styles'
import { Button } from '../../shared/basic/Button'
import { cn } from '../../shared/lib/utils'
import { useApp } from '../../src/AppContext'

export function UpdateNotification() {
  const {
    updateStatus,
    updateInfo,
    updateProgress,
    updateError,
    setUpdateStatus,
  } = useApp()

  useEffect(() => {
    if (updateStatus === 'error') {
      const timer = setTimeout(() => {
        setUpdateStatus('idle')
      }, 8000) // Auto-close error after 8 seconds
      return () => clearTimeout(timer)
    }
    return undefined
  }, [updateStatus, setUpdateStatus])

  if (updateStatus === 'idle') return null

  const isError = updateStatus === 'error'

  return (
    <div className="fixed bottom-4 right-4 z-modal animate-in slide-in-from-bottom-2 fade-in">
      <div
        className={cn(
          'bg-popover border border-border shadow-2xl rounded-xl p-4 min-w-[320px] max-w-md flex flex-col gap-3 transition-all duration-300',
          isError && 'border-destructive/50',
        )}
      >
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

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setUpdateStatus('idle')}
            className="h-7 w-7 text-muted-foreground"
          >
            <X size={16} />
          </Button>
        </div>

        {isError ? (
          <div className="bg-destructive/5 rounded-lg p-2 max-h-[120px] overflow-auto scrollbar-thin">
            <p className="text-xs text-destructive/90 break-words whitespace-pre-wrap font-mono leading-relaxed">
              {updateError || 'Unknown error occurred during update.'}
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground truncate px-1">
            {updateStatus === 'downloaded'
              ? 'Restart to apply changes'
              : 'Aynite Release Pipeline'}
          </p>
        )}

        {updateStatus === 'downloading' && (
          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden mt-1">
            <div
              className="bg-primary h-full transition-all duration-300"
              style={{ width: `${updateProgress}%` }}
            />
          </div>
        )}

        {updateStatus === 'downloaded' && (
          <Button
            variant="primary"
            onClick={() => window.aynite.installUpdate()}
            className="w-full mt-1 shadow-lg shadow-primary/20"
          >
            <RefreshCw size={14} /> Restart and Update
          </Button>
        )}
      </div>
    </div>
  )
}
