import { CloudDownload, RefreshCw, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { AppEvents } from '../../lib/constants/app'
import type { UpdateStatus } from '../../lib/types/app'
import { config } from '../bridge/config'
import { events } from '../bridge/events'
import { updateMutations } from '../bridge/update'
import { Button } from '../shared/basic/Button'
import { Modal } from '../shared/basic/Modal'
import { useI18n } from '../shared/i18n/useI18n'

/**
 * Global update notification.
 * Listens for update events from the main process and notifies the user.
 */
export function UpdateBanner() {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle')
  const [updateInfo, setUpdateInfo] = useState<any>(null)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [appVersion, setAppVersion] = useState('')
  const [locale, setLocale] = useState<'en' | 'zh'>('en')
  const { t } = useI18n(locale)

  // Listen for update events and locale
  useEffect(() => {
    config
      .get('version')
      .then((v: string) => {
        setAppVersion(v || '0.0.0')
      })
      .catch(() => {})

    config
      .get('language')
      .then((lang: string) => {
        if (lang === 'zh' || lang === 'en') setLocale(lang)
      })
      .catch(() => {})

    const unbind = events.onAppEvent((event: { type: string; data: any }) => {
      switch (event.type) {
        case AppEvents.UPDATE_AVAILABLE:
          setUpdateStatus('available')
          setUpdateInfo(event.data)
          setShowModal(true)
          break
        case AppEvents.UPDATE_NOT_AVAILABLE:
          setUpdateStatus('idle')
          setUpdateInfo(null)
          setDownloadProgress(0)
          break
        case AppEvents.UPDATE_DOWNLOADING:
          setUpdateStatus('downloading')
          setDownloadProgress(0)
          break
        case AppEvents.UPDATE_PROGRESS:
          setUpdateStatus('downloading')
          setDownloadProgress(event.data?.percent ?? 0)
          break
        case AppEvents.UPDATE_DOWNLOADED:
          setUpdateStatus('downloaded')
          setDownloadProgress(100)
          setUpdateInfo(event.data)
          setDismissed(false)
          setShowModal(true)
          break
        case AppEvents.UPDATE_ERROR:
          setUpdateStatus('error')
          break
        case AppEvents.LANGUAGE_CHANGED: {
          const newLocale = (event.data as any)?.language
          if (newLocale === 'zh' || newLocale === 'en') setLocale(newLocale)
          break
        }
      }
    })
    return unbind
  }, [])

  const handleDownloadUpdate = useCallback(async () => {
    setUpdateStatus('downloading')
    setDownloadProgress(0)
    setShowModal(true)
    await updateMutations.download()
  }, [])

  const handleInstallUpdate = useCallback(async () => {
    await updateMutations.install()
  }, [])

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

  // Fully hidden if dismissed (no badge, no modal)
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
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {downloadProgress.toFixed(0)}%
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
    if (updateStatus === 'downloading') {
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
          <button
            type="button"
            onClick={handleBadgeClick}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-full shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all animate-in slide-in-from-bottom-4"
          >
            <CloudDownload size={16} />
            <span className="text-sm font-medium">
              {t('update.badgeReady')}
            </span>
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-accent/50 text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
            aria-label={t('update.dismiss')}
          >
            <X size={14} />
          </button>
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
