import { Bug, CloudDownload, GitBranch, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { UpdateStatus } from '../../../lib/types/app'
import { config } from '../../bridge/config'
import { updateMutations } from '../../bridge/update'
import { AppIcon } from '../../shared/basic/AppIcon'
import { Button } from '../../shared/basic/Button'
import { Modal } from '../../shared/basic/Modal'
import { Section } from '../../shared/basic/Section'
import { SettingsPage } from '../../shared/featured/SettingsPage'
import { useViewEvent } from '../useViewEvents'

interface AboutTabProps {
  onOpenExternal: (url: string) => void
  t: (key: string) => string
}

export function AboutTab({ onOpenExternal, t }: AboutTabProps) {
  const [appVersion, setAppVersion] = useState('')
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle')
  const [updateInfo, setUpdateInfo] = useState<any>(null)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    config.get('version').then((v: any) => {
      if (v) setAppVersion(v)
    })
  }, [])

  // Listen for update events
  useViewEvent('update-checking', () => {
    setUpdateStatus('checking')
  })
  useViewEvent('update-available', (data) => {
    setUpdateStatus('available')
    setUpdateInfo(data)
  })
  useViewEvent('update-not-available', () => {
    setUpdateStatus('idle')
    setUpdateInfo(null)
    setDownloadProgress(0)
  })
  useViewEvent('update-downloading', () => {
    setUpdateStatus('downloading')
    setDownloadProgress(0)
  })
  useViewEvent('update-download-progress', (data) => {
    setUpdateStatus('downloading')
    setDownloadProgress(data?.percent ?? 0)
  })
  useViewEvent('update-downloaded', (data) => {
    setUpdateStatus('downloaded')
    setDownloadProgress(100)
    setUpdateInfo(data)
  })
  useViewEvent('update-error', (data) => {
    setUpdateStatus('error')
    setUpdateInfo(data)
  })

  const handleCheckUpdate = useCallback(() => {
    updateMutations.check()
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

  const handleCloseModal = useCallback(() => {
    setShowModal(false)
  }, [])

  const modalContent = () => {
    switch (updateStatus) {
      case 'checking':
        return (
          <div className="flex flex-col items-center text-center space-y-4 py-8">
            <RefreshCw size={40} className="animate-spin text-primary" />
            <div className="space-y-1">
              <p className="text-lg font-semibold">
                {t('about.update.checkingTitle')}
              </p>
              <p className="text-sm text-muted-foreground">
                {t('about.update.current')} {appVersion}
              </p>
            </div>
          </div>
        )
      case 'available':
        return (
          <div className="flex flex-col items-center text-center space-y-4 py-8">
            <CloudDownload size={40} className="text-primary" />
            <div className="space-y-1">
              <p className="text-lg font-semibold">
                {t('about.update.availableTitle')}
              </p>
              <p className="text-sm text-muted-foreground">
                {t('about.update.current')} {appVersion}
              </p>
              <p className="text-sm font-medium text-primary">
                {t('about.update.new')} v{updateInfo?.version || '?'}
              </p>
            </div>
          </div>
        )
      case 'downloading':
        return (
          <div className="flex flex-col items-center text-center space-y-6 py-8">
            <RefreshCw size={40} className="animate-spin text-primary" />
            <div className="space-y-1">
              <p className="text-lg font-semibold">
                {t('about.update.downloadingTitle')}
              </p>
              <p className="text-sm text-muted-foreground">
                v{updateInfo?.version || '?'}
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
              <p className="text-lg font-semibold">
                {t('about.update.downloadedTitle')}
              </p>
              <p className="text-sm text-muted-foreground">
                v{updateInfo?.version || '?'} {t('about.update.downloadedMsg')}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('about.update.saveWorkMsg')}
              </p>
            </div>
          </div>
        )
      case 'error':
        return (
          <div className="flex flex-col items-center text-center space-y-4 py-8">
            <Bug size={24} className="text-destructive" />
            <div className="space-y-1">
              <p className="text-lg font-semibold">
                {t('about.update.failedTitle')}
              </p>
              <p className="text-sm text-muted-foreground max-w-sm">
                {updateInfo?.message || t('about.update.errorMsg')}
              </p>
              <p className="text-xs text-muted-foreground">
                {updateInfo?.version ? `Version: ${updateInfo.version}` : ''}
              </p>
            </div>
          </div>
        )
      default:
        return (
          <div className="flex flex-col items-center text-center space-y-4 py-8">
            <CloudDownload size={28} className="text-primary" />
            <div className="space-y-1">
              <p className="text-lg font-semibold">
                {t('about.update.upToDateTitle')}
              </p>
              <p className="text-sm text-muted-foreground">
                {t('about.update.upToDateMsg')}
              </p>
            </div>
          </div>
        )
    }
  }

  const modalFooter = () => {
    if (updateStatus === 'downloaded') {
      return (
        <>
          <Button variant="ghost" onClick={handleCloseModal}>
            {t('about.update.later')}
          </Button>
          <Button
            variant="primary"
            onClick={handleInstallUpdate}
            className="shadow-lg shadow-primary/20"
          >
            <RefreshCw size={16} />
            {t('about.update.quitInstall')}
          </Button>
        </>
      )
    }
    if (updateStatus === 'available') {
      return (
        <>
          <Button variant="ghost" onClick={handleCloseModal}>
            {t('about.update.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={handleDownloadUpdate}
            className="shadow-lg shadow-primary/20"
          >
            <CloudDownload size={16} />
            {t('about.update.downloadUpdate')}
          </Button>
        </>
      )
    }
    if (updateStatus === 'downloading') {
      return null
    }
    return (
      <Button variant="ghost" onClick={handleCloseModal}>
        {t('about.update.close')}
      </Button>
    )
  }

  const statusLabel = () => {
    switch (updateStatus) {
      case 'idle':
        return t('about.update.statusIdle')
      case 'checking':
        return t('about.update.statusChecking')
      case 'available':
        return t('about.update.available')
      case 'downloading':
        return t('about.update.downloading')
      case 'downloaded':
        return t('about.update.statusReady')
      case 'error':
        return t('about.update.statusFailed')
    }
  }

  return (
    <SettingsPage title={t('about.title')} description={t('about.description')}>
      {/* Header: app icon + name + version on one line */}
      <div className="flex flex-col items-center text-center space-y-4 pt-4 mb-8">
        <AppIcon containerClassName="w-20 h-20" logoSvgClassName="w-14 h-14" />
        <div className="space-y-2 text-center">
          <h3 className="text-4xl font-black tracking-tighter text-foreground">
            Aynite
          </h3>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <span className="font-medium uppercase tracking-wider opacity-60">
              {t('about.version')}
            </span>
            <span className="font-mono font-semibold text-foreground/80">
              v{appVersion}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {/* Resources — full width, cards in a 2-column grid */}
        <Section
          title={t('about.resources.title')}
          description={t('about.resources.description')}
        >
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              size="lg"
              onClick={() =>
                onOpenExternal('https://github.com/w-t-yang/aynite')
              }
              className="flex items-center justify-start gap-3 p-4 text-sm font-medium h-auto hover:bg-accent transition-all"
            >
              <GitBranch size={18} className="text-foreground" />
              <div className="text-left">
                <div className="font-bold">{t('about.resources.github')}</div>
                <div className="text-[10px] text-muted-foreground font-normal">
                  {t('about.resources.githubDesc')}
                </div>
              </div>
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() =>
                onOpenExternal('https://github.com/w-t-yang/aynite/issues')
              }
              className="flex items-center justify-start gap-3 p-4 text-sm font-medium h-auto hover:bg-accent transition-all"
            >
              <Bug size={18} className="text-destructive" />
              <div className="text-left">
                <div className="font-bold">
                  {t('about.resources.reportIssue')}
                </div>
                <div className="text-[10px] text-muted-foreground font-normal">
                  {t('about.resources.reportIssueDesc')}
                </div>
              </div>
            </Button>
          </div>
        </Section>

        {/* Software Update — full width */}
        <Section
          title={t('about.update.title')}
          description={t('about.update.description')}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <CloudDownload size={16} className="text-primary" />
                {updateStatus === 'downloaded'
                  ? t('about.update.updateReady')
                  : t('about.update.status')}
              </h4>
              <p className="text-xs text-muted-foreground">{statusLabel()}</p>
            </div>

            <div className="flex gap-2 shrink-0">
              {(updateStatus === 'idle' || updateStatus === 'error') && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCheckUpdate}
                  className="px-4 py-1.5"
                >
                  {t('about.update.checkButton')}
                </Button>
              )}
              {updateStatus === 'checking' && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="px-4 py-1.5 flex items-center gap-2"
                  disabled
                >
                  <RefreshCw size={12} className="animate-spin" />{' '}
                  {t('about.update.checking')}
                </Button>
              )}
              {(updateStatus === 'available' ||
                updateStatus === 'downloading') && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowModal(true)}
                  className="px-4 py-1.5"
                >
                  {updateStatus === 'downloading'
                    ? t('about.update.downloading')
                    : t('about.update.available')}
                </Button>
              )}
              {updateStatus === 'downloaded' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowModal(true)}
                  className="px-4 py-1.5 shadow-lg shadow-primary/20 transition-all flex items-center gap-1"
                >
                  <RefreshCw size={12} />
                  {t('about.update.downloaded')}
                </Button>
              )}
            </div>
          </div>
        </Section>
      </div>

      {/* Update Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={t('about.update.modalTitle')}
        size="sm"
        footer={modalFooter()}
      >
        {modalContent()}
      </Modal>
    </SettingsPage>
  )
}
