import React, { useState } from 'react'
import Dropdown from './shared/Dropdown'
import FormModal from './shared/compound/FormModal'
import { useApp } from '../context/AppContext'
import { useTheme } from '../context/ThemeContext'

const TitleBar: React.FC = () => {
  const { workspaceConfig, workspaces, switchWorkspace, addWorkspace, switchLayout } = useApp()

  const { themes, activeTheme, setTheme } = useTheme()
  const [showAddWorkspaceModal, setShowAddWorkspaceModal] = useState(false)
  const platform = (window as any).aynite.platform
  const isMac = platform === 'darwin'

  if (!workspaceConfig) return null

  const WindowButtons = () => (
    <div
      className={`flex items-center gap-1.5 px-3 no-drag ${isMac ? 'order-first' : 'order-last'}`}
    >
      {isMac ? (
        <div className="flex items-center gap-2 pr-2">
          <button
            onClick={() => (window as any).aynite.close()}
            className="w-3 h-3 rounded-full bg-[#ff5f56] hover:brightness-90 transition-all border border-black/10"
          />
          <button
            onClick={() => (window as any).aynite.minimize()}
            className="w-3 h-3 rounded-full bg-[#ffbd2e] hover:brightness-90 transition-all border border-black/10"
          />
          <button
            onClick={() => (window as any).aynite.maximize()}
            className="w-3 h-3 rounded-full bg-[#27c93f] hover:brightness-90 transition-all border border-black/10"
          />
        </div>
      ) : (
        <>
          <button
            onClick={() => (window as any).aynite.minimize()}
            className="p-2 hover:bg-white/10 rounded-md transition-colors text-muted-foreground"
          >
            <svg width="12" height="12" viewBox="0 0 12 12">
              <line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
          <button
            onClick={() => (window as any).aynite.maximize()}
            className="p-2 hover:bg-white/10 rounded-md transition-colors text-muted-foreground"
          >
            <svg width="12" height="12" viewBox="0 0 12 12">
              <rect
                x="1.5"
                y="1.5"
                width="9"
                height="9"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
          </button>
          <button
            onClick={() => (window as any).aynite.close()}
            className="p-2 hover:bg-red-500 hover:text-white rounded-md transition-colors text-muted-foreground"
          >
            <svg width="12" height="12" viewBox="0 0 12 12">
              <line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="1.5" />
              <line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </>
      )}
    </div>
  )

  return (
    <>
      <div className="h-9 flex items-center justify-between bg-sidebar/80 backdrop-blur-md border-b border-border select-none drag px-1">
        <div className="flex items-center no-drag">
          {isMac && <WindowButtons />}
          <div className="flex items-center gap-1 ml-2">
            {[
              { id: 'layout-1', label: '1', title: 'Single Tile' },
              { id: 'layout-2', label: '2', title: 'Split View' },
              { id: 'layout-3', label: '3', title: 'Triple Column' }
            ].map((layout) => (
              <button
                key={layout.id}
                onClick={() => switchLayout(layout.id)}
                title={layout.title}
                className={`w-6 h-6 flex items-center justify-center rounded text-[11px] font-bold transition-all ${
                  workspaceConfig.activeLayoutId === layout.id
                    ? 'bg-accent text-accent-foreground shadow-[0_0_8px_rgba(var(--accent-rgb),0.3)]'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {layout.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 flex justify-center items-center gap-2">
          <Dropdown
            trigger={
              <button className="no-drag px-3 py-1 rounded-md hover:bg-muted transition-colors flex items-center gap-2 group">
                <span className="text-[13px] font-medium text-foreground group-hover:text-accent transition-colors">
                  {workspaceConfig.id}
                </span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3.5 w-3.5 text-muted-foreground group-hover:text-accent transition-colors"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            }
          >
            <div className="p-1.5 flex flex-col gap-0.5 min-w-[180px]">
              <div className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">
                Workspaces
              </div>
              {workspaces.map((id) => (
                <button
                  key={id}
                  onClick={() => switchWorkspace(id)}
                  className={`w-full px-3 py-2 text-left text-[13px] rounded-md transition-colors ${
                    id === workspaceConfig.id
                      ? 'bg-accent/10 text-accent font-medium'
                      : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {id}
                </button>
              ))}
              <div className="h-px bg-border my-1" />
              <button
                onClick={() => setShowAddWorkspaceModal(true)}
                className="w-full px-3 py-2 text-left text-[13px] text-accent hover:bg-accent/10 rounded-md transition-colors flex items-center gap-2"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                    clipRule="evenodd"
                  />
                </svg>
                New Workspace
              </button>
            </div>
          </Dropdown>
        </div>

        <div className="flex items-center no-drag pr-1 gap-2">
          {/* Theme Switcher */}
          <Dropdown
            trigger={
              <button
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-accent transition-colors"
                title="Change Theme"
              >
                {activeTheme?.type === 'light' ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z"
                    />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                    />
                  </svg>
                )}
              </button>
            }
            align="right"
          >
            <div className="p-1.5 flex flex-col gap-0.5 min-w-[140px]">
              <div className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">
                Themes
              </div>
              {themes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`w-full px-3 py-2 text-left text-[13px] rounded-md transition-colors flex items-center justify-between ${
                    t.id === activeTheme?.id
                      ? 'bg-accent/10 text-accent font-medium'
                      : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t.name}
                  <div
                    className="w-3 h-3 rounded-full border border-border"
                    style={{ background: t.colors.primary }}
                  />
                </button>
              ))}
            </div>
          </Dropdown>

          <div className="flex items-center gap-2 px-3 py-1 border-l border-border ml-1">
            <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em]">
              Aynite
            </span>
          </div>
          {!isMac && <WindowButtons />}
        </div>
      </div>

      {showAddWorkspaceModal && (
        <FormModal
          onClose={() => setShowAddWorkspaceModal(false)}
          title="Create New Workspace"
          label="Workspace Name"
          placeholder="e.g. My Project"
          onSubmit={(name) => {
            addWorkspace(name)
            setShowAddWorkspaceModal(false)
          }}
        />
      )}
    </>
  )
}

export default TitleBar
