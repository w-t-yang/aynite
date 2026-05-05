import type React from 'react'
import { AppProvider, useApp } from './context/AppContext'
import { ThemeProvider } from './context/ThemeContext'
import TileNode from './layout/TileNode'
import TitleBar from './layout/TitleBar'

const AppContent: React.FC = () => {
  const { workspaceConfig } = useApp()

  if (!workspaceConfig)
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background text-foreground">
        <div className="animate-pulse font-semibold">Loading Aynite...</div>
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
    </div>
  )
}

const App: React.FC = () => (
  <ThemeProvider>
    <AppProvider>
      <AppContent />
    </AppProvider>
  </ThemeProvider>
)

export default App
