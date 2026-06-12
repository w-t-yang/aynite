import { Bot, Bug, CloudDownload, GitBranch, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { FLEX_CENTER_GAP_2 } from '../../../lib/constants/renderer/styles'
import type { UpdateStatus } from '../../../lib/types/app'
import { config, configMutations } from '../../bridge/config'
import { updateMutations } from '../../bridge/update'
import { Button } from '../../shared/basic/Button'
import { Modal } from '../../shared/basic/Modal'
import { Section } from '../../shared/basic/Section'
import { Switch } from '../../shared/basic/Switch'
import { SettingsPage } from '../../shared/featured/SettingsPage'
import { useViewEvent } from '../useViewEvents'

interface AboutTabProps {
  state: {
    appVersion: string
  }
  actions: {
    onOpenExternal: (url: string) => void
  }
}

export function AboutTab({ state, actions }: AboutTabProps) {
  const { appVersion } = state
  const { onOpenExternal } = actions

  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle')
  const [updateInfo, setUpdateInfo] = useState<any>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [telemetryEnabled, setTelemetryEnabled] = useState(false)

  // Load telemetry preference on mount
  useEffect(() => {
    config.get('telemetry').then((t) => {
      setTelemetryEnabled(t.enabled)
    })
  }, [])

  // Handle telemetry toggle
  const handleTelemetryToggle = useCallback(async (checked: boolean) => {
    setTelemetryEnabled(checked)
    await configMutations.set('telemetry', { enabled: checked })
  }, [])

  // Listen for relayed update events — update the status text without auto-opening modal
  useViewEvent('update-checking', () => {
    setUpdateStatus('checking')
    setUpdateInfo(null)
    setUpdateError(null)
    setDownloadProgress(0)
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
    setUpdateError(data)
    setDownloadProgress(0)
  })

  const handleCheckUpdates = useCallback(async () => {
    setShowUpdateModal(true)
    setUpdateStatus('checking')
    setUpdateInfo(null)
    setUpdateError(null)
    setDownloadProgress(0)
    await updateMutations.check()
  }, [])

  const handleDownloadUpdate = useCallback(async () => {
    setUpdateStatus('downloading')
    setDownloadProgress(0)
    await updateMutations.download()
  }, [])

  const handleInstallUpdate = useCallback(async () => {
    await updateMutations.install()
  }, [])

  const handleCloseModal = useCallback(() => {
    setShowUpdateModal(false)
  }, [])

  // ─── Update Modal Content ─────────────────────────────────────────────

  const updateModalContent = () => {
    switch (updateStatus) {
      case 'checking':
        return (
          <div className="flex flex-col items-center text-center space-y-4 py-8">
            <RefreshCw size={40} className="animate-spin text-primary" />
            <div className="space-y-1">
              <p className="text-lg font-semibold">Checking for Updates...</p>
              <p className="text-sm text-muted-foreground">
                Current version: {appVersion || '0.0.0'}
              </p>
            </div>
          </div>
        )

      case 'available':
        return (
          <div className="flex flex-col items-center text-center space-y-4 py-8">
            <CloudDownload size={40} className="text-primary" />
            <div className="space-y-1">
              <p className="text-lg font-semibold">Update Available</p>
              <p className="text-sm text-muted-foreground">
                Current: {appVersion || '0.0.0'}
              </p>
              <p className="text-sm font-medium text-primary">
                New: v{updateInfo?.version || '?'}
              </p>
            </div>
          </div>
        )

      case 'downloading':
        return (
          <div className="flex flex-col items-center text-center space-y-6 py-8">
            <RefreshCw size={40} className="animate-spin text-primary" />
            <div className="space-y-1">
              <p className="text-lg font-semibold">Downloading Update...</p>
              <p className="text-sm text-muted-foreground">
                v{updateInfo?.version || '?'}
              </p>
            </div>
            {/* Progress bar */}
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
              <p className="text-lg font-semibold">Update Ready</p>
              <p className="text-sm text-muted-foreground">
                v{updateInfo?.version || '?'} has been downloaded.
              </p>
              <p className="text-xs text-muted-foreground">
                Save your work, then quit and install the update.
              </p>
            </div>
          </div>
        )

      case 'error':
        return (
          <div className="flex flex-col items-center text-center space-y-4 py-8">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <Bug size={24} className="text-destructive" />
            </div>
            <div className="space-y-1">
              <p className="text-lg font-semibold">Update Failed</p>
              <p className="text-sm text-muted-foreground max-w-sm">
                {updateError ||
                  'An unknown error occurred. Please try again later.'}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Current version: {appVersion || '0.0.0'}
            </p>
          </div>
        )
      default:
        return (
          <div className="flex flex-col items-center text-center space-y-4 py-8">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot size={28} className="text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-lg font-semibold">You're Up to Date</p>
              <p className="text-sm text-muted-foreground">
                Aynite {appVersion || '0.0.0'} is the latest version.
              </p>
            </div>
          </div>
        )
    }
  }

  const updateModalFooter = () => {
    if (updateStatus === 'downloaded') {
      return (
        <>
          <Button variant="ghost" onClick={handleCloseModal}>
            Later
          </Button>
          <Button
            variant="primary"
            onClick={handleInstallUpdate}
            className="shadow-lg shadow-primary/20"
          >
            <RefreshCw size={16} />
            Quit & Install
          </Button>
        </>
      )
    }
    if (updateStatus === 'available') {
      return (
        <>
          <Button variant="ghost" onClick={handleCloseModal}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleDownloadUpdate}
            className="shadow-lg shadow-primary/20"
          >
            <CloudDownload size={16} />
            Download & Update
          </Button>
        </>
      )
    }
    return (
      <Button variant="ghost" onClick={handleCloseModal}>
        Close
      </Button>
    )
  }

  // ─── Main Tab UI ──────────────────────────────────────────────────────

  const updateButton = (
    <div className={FLEX_CENTER_GAP_2}>
      {(updateStatus === 'idle' || updateStatus === 'error') && (
        <Button
          variant="secondary"
          size="sm"
          onClick={handleCheckUpdates}
          className="px-4 py-1.5"
        >
          Check for Updates
        </Button>
      )}
      {updateStatus === 'checking' && (
        <Button
          disabled
          variant="secondary"
          size="sm"
          className="px-4 py-1.5 flex items-center gap-2"
        >
          <RefreshCw size={12} className="animate-spin" /> Checking
        </Button>
      )}
      {(updateStatus === 'available' || updateStatus === 'downloading') && (
        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowUpdateModal(true)}
          className="px-4 py-1.5"
        >
          <CloudDownload size={14} />{' '}
          {updateStatus === 'downloading'
            ? 'Downloading...'
            : 'Update Available'}
        </Button>
      )}
      {updateStatus === 'downloaded' && (
        <Button
          variant="primary"
          size="sm"
          onClick={handleInstallUpdate}
          className="px-4 py-1.5 shadow-lg shadow-primary/20 transition-all flex items-center gap-1"
        >
          <RefreshCw size={14} /> Quit & Install
        </Button>
      )}
    </div>
  )

  const statusLabel = (() => {
    switch (updateStatus) {
      case 'idle':
        return 'Software is up to date.'
      case 'checking':
        return 'Checking...'
      case 'available':
        return `New: v${updateInfo?.version || '?'}`
      case 'downloading':
        return `Downloading... ${downloadProgress.toFixed(0)}%`
      case 'downloaded':
        return 'Ready to install. Quit and install the update.'
      case 'error':
        return 'Check failed.'
    }
  })()

  return (
    <>
      <SettingsPage
        title="About Aynite"
        description="Information about Aynite, system updates, and developer resources."
      >
        <div className="flex flex-col items-center text-center space-y-4 pt-4 mb-8">
          <div className="w-24 h-24 rounded-3xl bg-primary flex items-center justify-center shadow-2xl shadow-primary/20 border-4 border-background">
            <Bot size={56} className="text-primary-foreground" />
          </div>
          <div className="space-y-1.5 text-center">
            <h3 className="text-4xl font-black tracking-tighter text-foreground">
              Aynite
            </h3>
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-bold text-primary tracking-[0.3em] uppercase">
                A.Y.N.I.T.E
              </p>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest opacity-60">
                All You Need Is The Editor
              </p>
            </div>
          </div>
          <div className="px-4 py-1.5 bg-accent/30 rounded-full border border-border/50 text-xs font-mono text-muted-foreground shadow-sm">
            Version {appVersion || '0.0.0'}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8">
          <Section
            title="Software Update"
            description="Keep your application up to date with the latest features."
          >
            <div className="p-6 rounded-2xl border border-border bg-accent/5 flex items-center justify-between group">
              <div className="space-y-1">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <CloudDownload size={16} className="text-primary" />
                  {updateStatus === 'downloaded' ? 'Update Ready' : 'Status'}
                </h4>
                <p className="text-xs text-muted-foreground">{statusLabel}</p>
              </div>
              {updateButton}
            </div>
          </Section>

          <Section
            title="Resources"
            description="Join the community and help improve the project."
          >
            <div className="grid grid-cols-1 gap-3">
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
                  <div className="font-bold">GitHub Project</div>
                  <div className="text-[10px] text-muted-foreground font-normal">
                    View source code
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
                  <div className="font-bold">Report an Issue</div>
                  <div className="text-[10px] text-muted-foreground font-normal">
                    Submit bug reports
                  </div>
                </div>
              </Button>
            </div>
          </Section>

          <Section
            title="Usage Analytics"
            description="Help improve Aynite by sharing anonymous usage data."
          >
            <div className="p-6 rounded-2xl border border-border bg-accent/5 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold">
                  Share anonymous usage data
                </h4>
                <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                  No file paths, names, or personal content
                </p>
              </div>
              <Switch
                checked={telemetryEnabled}
                onCheckedChange={handleTelemetryToggle}
              />
            </div>
          </Section>
        </div>

        <div className="pt-20 text-center">
          <p className="text-[10px] text-muted-foreground/30 font-mono italic tracking-widest">
            BUILT WITH ❤️ FOR THE AI LIFESTYLE
          </p>
        </div>
      </SettingsPage>

      {/* Update Modal — only opens when user clicks "Check for Updates" */}
      <Modal
        isOpen={showUpdateModal}
        onClose={handleCloseModal}
        title="Software Update"
        size="sm"
        footer={updateModalFooter()}
      >
        {updateModalContent()}
      </Modal>
    </>
  )
}
