import { CloudDownload, RefreshCw, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { config } from '../bridge/config'
import { Button } from '../shared/basic/Button'
import { Modal } from '../shared/basic/Modal'
import { useI18n } from '../shared/i18n/useI18n'
import { useApp } from './AppContext'

/**
 * Global update notification.
 * Reads update state from UpdateContext (routed by the Hub from main process events).
 * Keeps only local UI state (showModal, dismissed).
 */
export function UpdateBanner() {
  const { updateStatus, updateInfo, updateProgress, installUpdate, locale } =
    useApp()
  const [showModal, setShowModal] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [appVersion, setAppVersion] = useState('')
  const { t } = useI18n(locale)

  // Load app version on mount
  useEffect(() => {
    config
      .get('version')
      .then((v: string) => {
        setAppVersion(v || '0.0.0')
      })
      .catch(() => {})
  }, [])

  // Show modal when update becomes available or downloaded
  useEffect(() => {
    if (updateStatus === 'available' || updateStatus === 'downloaded') {
      setShowModal(true)
    }
  }, [updateStatus])

  const handleDownloadUpdate = useCallback(async () => {
    const { updateMutations } = await import('../bridge/update')
    setShowModal(true)
    await updateMutations.download()
  }, [])

  const handleInstallUpdate = useCallback(async () => {
    await installUpdate()
  }, [installUpdate])

  const handleClose = useCallback(() => {
    setShowModal(false)
  }, [])

  const handleDismiss = useCallback(() => {
    setDismissed(true)
    setShowModal(false)
  }, [])

  const handleBadgeClick = useCallback(() => {
    setShowModal(true)
  }, [])

  // Fully hidden if dismissed or idle (with no modal open)
  if (dismissed || (updateStatus === 'idle' && !showModal)) return null

  const modalContent = () => {
    switch (updateStatus) {
      case 'available':
        return (
          <div className="flex flex-col items-center text-center space-y-4 py-8">
            <CloudDownload size={40} className="text-primary" />
            <div className="space-y-1">
              <p className="text-lg font-semibold">{t('update.available')}</p>
              <p className="text-sm text-muted-foreground">
                {t('update.current')} {appVersion}
              </p>
              <p className="text-sm font-medium text-primary">
                {t('update.new')} v
                {updateInfo?.version || t('update.unknownVersion')}
              </p>
            </div>
          </div>
        )
      case 'checking':
      case 'downloading':
        return (
          <div className="flex flex-col items-center text-center space-y-6 py-8">
            <RefreshCw size={40} className="animate-spin text-primary" />
            <div className="space-y-1">
              <p className="text-lg font-semibold">{t('update.downloading')}</p>
              <p className="text-sm text-muted-foreground">
                v{updateInfo?.version || t('update.unknownVersion')}
              </p>
            </div>
            <div className="w-full max-w-xs mx-auto space-y-2">
              <div className="w-full h-2 bg-accent/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${updateProgress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {updateProgress.toFixed(0)}%
              </p>
            </div>
          </div>
        )
      case 'downloaded':
        return (
          <div className="flex flex-col items-center text-center space-y-4 py-8">
            <CloudDownload size={40} className="text-primary" />
            <div className="space-y-1">
              <p className="text-lg font-semibold">{t('update.ready')}</p>
              <p className="text-sm text-muted-foreground">
                v{updateInfo?.version || t('update.unknownVersion')}{' '}
                {t('update.downloaded')}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('update.saveWork')}
              </p>
            </div>
          </div>
        )
      default:
        return null
    }
  }

  const modalFooter = () => {
    if (updateStatus === 'downloaded') {
      return (
        <>
          <Button variant="ghost" onClick={handleDismiss}>
            {t('update.later')}
          </Button>
          <Button
            variant="primary"
            onClick={handleInstallUpdate}
            className="shadow-lg shadow-primary/20"
          >
            <RefreshCw size={16} />
            {t('update.quitInstall')}
          </Button>
        </>
      )
    }
    if (updateStatus === 'available') {
      return (
        <>
          <Button variant="ghost" onClick={handleClose}>
            {t('update.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={handleDownloadUpdate}
            className="shadow-lg shadow-primary/20"
          >
            <CloudDownload size={16} />
            {t('update.downloadUpdate')}
          </Button>
        </>
      )
    }
    if (updateStatus === 'checking' || updateStatus === 'downloading') {
      return null
    }
    return (
      <Button variant="ghost" onClick={handleClose}>
        {t('update.close')}
      </Button>
    )
  }

  return (
    <>
      {/* Floating badge — only shows when downloaded and not dismissed */}
      {updateStatus === 'downloaded' && !showModal && !dismissed && (
        <div className="fixed bottom-4 right-4 z-modal flex items-center gap-2">
          <Button
            variant="primary"
            onClick={handleBadgeClick}
            className="rounded-full shadow-lg shadow-primary/30 animate-in slide-in-from-bottom-4"
          >
            <CloudDownload size={16} />
            <span className="text-sm font-medium">
              {t('update.badgeReady')}
            </span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            className="rounded-full bg-accent/50"
            aria-label={t('update.dismiss')}
          >
            <X size={14} />
          </Button>
        </div>
      )}

      <Modal
        isOpen={showModal && updateStatus !== 'idle'}
        onClose={handleClose}
        title={
          updateStatus === 'downloaded'
            ? t('update.ready')
            : t('update.softwareUpdate')
        }
        size="sm"
        footer={modalFooter()}
      >
        {modalContent()}
      </Modal>
    </>
  )
}
