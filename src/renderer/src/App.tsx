import type React from 'react'
import { useEffect } from 'react'
import { DEFAULT_KEYBINDINGS } from '../../lib/constants/keybindings'
import { FileSwitcher } from '../shared/featured/FileSwitcher'
import { SettingsModal } from '../shared/featured/SettingsModal'
import { useI18n } from '../shared/i18n/useI18n'
import { KeyManager } from '../shared/lib/key-handlers'
import { AppProvider, useApp } from './AppContext'
import TileNode from './layout/TileNode'
import TitleBar from './layout/TitleBar'
import { NotificationProvider } from './NotificationProvider'
import { UpdateBanner } from './UpdateBanner'

const AppContent: React.FC = () => {
  const {
    workspaceConfig,
    showFileSwitcher,
    setShowFileSwitcher,
    showSettings,
    locale,
  } = useApp()
  const { t } = useI18n(locale)

  useEffect(() => {
    const api = {
      saveActiveTab: () => {}, // TODO
      reload: () => {
        const activeTile = document.querySelector('.tile.border-primary')
        if (activeTile) {
          const iframe = activeTile.querySelector(
            'iframe',
          ) as HTMLIFrameElement | null
          if (iframe?.contentWindow) {
            try {
              iframe.contentWindow.location.reload()
            } catch {
              iframe.contentWindow.postMessage(
                { type: 'aynite:refresh-tile' },
                '*',
              )
            }
          }
        }
      },
      toggleLeftPanel: () => {},
      toggleRightPanel: () => {},
      focusChat: () => {},
      focusSkills: () => {},
      focusCommands: () => {},
      closeTab: () => {},
      switchTab: () => {},
      focusContent: () => {},
      closeFileSwitcher: () => setShowFileSwitcher(false),
      isFileSwitcherOpen: () => showFileSwitcher,
      toggleFileSwitcher: () => setShowFileSwitcher((prev: boolean) => !prev),
    }
    // Load keybindings from defaults; in the future this can be
    // fetched from config and deep-merged over the defaults.
    KeyManager.init({ keybindings: structuredClone(DEFAULT_KEYBINDINGS) }, api)
    return () => KeyManager.cleanup()
  }, [showFileSwitcher, setShowFileSwitcher])

  if (!workspaceConfig)
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background text-foreground">
        <div className="animate-pulse font-semibold">{t('app.loading')}</div>
      </div>
    )

  const activeLayout = workspaceConfig.layouts.find(
    (l: any) => l.id === workspaceConfig.activeLayoutId,
  )

  return (
    <div className="h-screen w-screen flex flex-col relative bg-background">
      <TitleBar />
      <div id="layout-container" className="flex-1 flex overflow-hidden p-0.5">
        {activeLayout && <TileNode isRoot node={activeLayout.layout} />}
      </div>
      {showFileSwitcher && <FileSwitcher />}
      {showSettings && <SettingsModal />}
      <UpdateBanner />
    </div>
  )
}

const App: React.FC = () => (
  <AppProvider>
    <AppContent />
    <NotificationProvider />
  </AppProvider>
)

export default App
