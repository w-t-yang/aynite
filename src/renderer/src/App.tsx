import type React from 'react'
import { useEffect, useRef } from 'react'
import { DEFAULT_KEYBINDINGS } from '../../lib/constants/keybindings'
import { FileSwitcher } from '../shared/featured/FileSwitcher'
import { useI18n } from '../shared/i18n/useI18n'
import { KeyManager } from '../shared/lib/key-handlers'
import { AppProvider, useApp } from './AppContext'
import Sidebar from './layout/Sidebar'
import TileNode from './layout/TileNode'
import TitleBar from './layout/TitleBar'
import { NotificationProvider } from './NotificationProvider'
import { UpdateBanner } from './UpdateBanner'

const AppContent: React.FC = () => {
  const {
    workspaceConfig,
    showFileSwitcher,
    setShowFileSwitcher,
    locale,
    executeAppOperation,
  } = useApp()
  const { t } = useI18n(locale)
  const execRef = useRef(executeAppOperation)
  execRef.current = executeAppOperation

  useEffect(() => {
    const api = {
      saveActiveTab: () => {}, // TODO
      reload: () => {
        execRef.current('REFRESH_TILE')
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
      toggleFileSwitcher: () => setShowFileSwitcher(!showFileSwitcher),
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
    <div className="h-screen w-screen flex flex-col relative bg-sidebar">
      <TitleBar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <div
          id="layout-container"
          className="flex-1 flex overflow-hidden p-0.5"
        >
          {activeLayout && <TileNode isRoot node={activeLayout.layout} />}
        </div>
      </div>
      {showFileSwitcher && <FileSwitcher />}
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
