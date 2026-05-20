import {
  ExternalLink,
  Minus,
  Moon,
  MoreHorizontal,
  Palette,
  Plus,
  Settings,
  Square,
  Sun,
  Trash2,
  X,
} from 'lucide-react'
import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import { AppEvents } from '../../../lib/constants/app'
import { FLEX_CENTER_GAP_1 } from '../../../lib/constants/renderer/styles'
import { Button } from '../../shared/basic/Button'
import { Modal } from '../../shared/basic/Modal'
import { FormModal } from '../../shared/featured/FormModal'
import { SelectionMenu } from '../../shared/featured/SelectionMenu'
import { cn } from '../../shared/lib/utils'
import { useApp } from '../AppContext'
import { LayoutVibeModal } from './LayoutVibeModal'

const isMac = window.aynite?.platform === 'darwin'

const TitleBar: React.FC = () => {
  const {
    workspaceConfig,
    workspaces,
    switchWorkspace,
    addWorkspace,
    deleteWorkspace,
    openNewWindow,
    switchLayout,
    addLayout,
    removeLayout,
    themes,
    activeTheme,
    setTheme,
    showTileControls,
    setShowTileControls,
    setShowSettings,
  } = useApp()
  const [showAddWorkspaceModal, setShowAddWorkspaceModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showVibeModal, setShowVibeModal] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Listen for window state changes
  useEffect(() => {
    if (!window.aynite?.onAppEvent) return
    const unsub = window.aynite.onAppEvent(
      (event: { type: string; data: unknown }) => {
        if (event.type === AppEvents.WINDOW_MAXIMIZED_CHANGED) {
          setIsMaximized((event.data as any)?.isMaximized ?? false)
        } else if (event.type === AppEvents.FULLSCREEN_CHANGED) {
          setIsFullscreen((event.data as any)?.isFullscreen ?? false)
        }
      },
    )
    return unsub
  }, [])

  const workspaceOptions = useMemo(
    () =>
      workspaces.map((id) => ({
        id,
        label: id,
      })),
    [workspaces],
  )

  const themeOptions = useMemo(
    () =>
      themes.map((t) => ({
        id: t.id,
        label: t.name,
        icon: (
          <div
            className="w-3 h-3 rounded-full border border-border"
            style={{ background: t.colors.primary }}
          />
        ),
        isActive: t.id === activeTheme?.id,
      })),
    [themes, activeTheme],
  )

  if (!workspaceConfig) return null

  const handleWindowAction = (action: 'minimize' | 'maximize' | 'close') => {
    switch (action) {
      case 'minimize':
        window.aynite?.minimizeWindow?.()
        break
      case 'maximize':
        window.aynite?.maximizeWindow?.()
        break
      case 'close':
        window.aynite?.closeWindow?.()
        break
    }
  }

  const handleDeleteWorkspace = async () => {
    if (workspaces.length <= 1) return
    setShowDeleteConfirm(true)
  }

  return (
    <>
      <div
        className={cn(
          'h-9 flex items-center justify-between bg-sidebar/80 backdrop-blur-md border-b border-border select-none drag relative z-layout',
          isMac && !isFullscreen ? 'pl-[78px] pr-2' : isMac ? 'pr-2' : 'px-2',
        )}
      >
        {/* Left: Workspace switcher */}
        <div className="flex items-center no-drag shrink-0">
          <SelectionMenu
            activeId={workspaceConfig.id}
            items={workspaceOptions}
            onSelect={switchWorkspace}
            divided={false}
            align="left"
            menuClassName="min-w-[260px]"
            trigger={
              <Button variant="ghost" size="sm" className={FLEX_CENTER_GAP_1}>
                <span>{workspaceConfig.id}</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3.5 w-3.5 text-muted-foreground"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <title>Chevron down</title>
                  <path
                    fillRule="evenodd"
                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </Button>
            }
            title="Workspaces"
            footer={
              <>
                <Button
                  variant="ghost"
                  onClick={() => setShowAddWorkspaceModal(true)}
                  className="w-full justify-start px-3 py-2 text-xs text-primary hover:bg-primary/10 rounded-md gap-2"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <title>Add</title>
                    <path
                      fillRule="evenodd"
                      d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  New Workspace
                </Button>
                {workspaces.length > 1 && (
                  <>
                    <div className="h-px bg-border/40 my-1 mx-1 shrink-0" />
                    <Button
                      variant="ghost"
                      onClick={handleDeleteWorkspace}
                      className="w-full justify-start px-3 py-2 text-xs text-destructive hover:bg-destructive/10 rounded-md gap-2 hover:text-destructive"
                    >
                      <Trash2 size={14} />
                      Delete Workspace ({workspaceConfig.id})
                    </Button>
                  </>
                )}
              </>
            }
          />
        </div>

        {/* Center: Layout switcher - truly centered in the titlebar */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 no-drag group/layouts px-1">
          {workspaceConfig.layouts.map((layout) => {
            const isActive = workspaceConfig.activeLayoutId === layout.id
            return (
              <Button
                variant="ghost"
                key={layout.id}
                onClick={() => switchLayout(layout.id)}
                title={layout.name}
                className={cn(
                  'w-5 h-5 rounded-md flex items-center justify-center transition-all p-0 min-w-0',
                  isActive ? 'bg-primary/10' : 'hover:bg-accent',
                )}
              >
                <div
                  className={cn(
                    'w-2 h-2 rounded-[3px] transition-all duration-300',
                    isActive
                      ? 'bg-primary scale-125'
                      : 'bg-muted-foreground/40 scale-100',
                  )}
                />
              </Button>
            )
          })}

          {/* Management Menu (Only visible on hover or if one is active) */}
          <div className="opacity-0 group-hover/layouts:opacity-100 transition-opacity ml-1 flex items-center gap-0.5">
            <SelectionMenu
              items={[
                {
                  id: 'add-vibe',
                  label: 'Add Vibe',
                  icon: <Plus size={14} />,
                  disabled: workspaceConfig.layouts.length >= 9,
                },
                {
                  id: 'remove-vibe',
                  label: 'Remove Current',
                  icon: <Trash2 size={14} />,
                  disabled: workspaceConfig.layouts.length <= 1,
                  type: 'danger' as any,
                },
              ]}
              onSelect={(id: string) => {
                if (id === 'add-vibe') setShowVibeModal(true)
                else if (id === 'remove-vibe')
                  removeLayout(workspaceConfig.activeLayoutId)
              }}
              trigger={
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-7 h-7 hover:bg-accent"
                >
                  <MoreHorizontal size={14} />
                </Button>
              }
              title="Layout Vibes"
            />
          </div>
        </div>

        {/* Right: App options + Window controls */}
        <div className="flex items-center gap-1 no-drag shrink-0">
          <SelectionMenu
            items={[
              {
                id: 'settings',
                label: 'Settings',
                icon: <Settings size={14} />,
              },
              { id: 'divider-0', type: 'divider' },
              {
                id: 'new-window',
                label: 'New Window',
                icon: <ExternalLink size={14} />,
              },
              { id: 'divider-1', type: 'divider' },
              {
                id: 'theme',
                label: 'Theme',
                icon:
                  activeTheme?.type === 'light' ? (
                    <Sun size={14} />
                  ) : (
                    <Moon size={14} />
                  ),
                submenu: themeOptions,
              },
              { id: 'divider-2', type: 'divider' },
              {
                id: 'toggle-controls',
                label: 'Show Tile Controls',
                icon: <Palette size={14} />,
                isActive: showTileControls,
              },
            ]}
            onSelect={(id: string) => {
              if (id === 'settings') setShowSettings(true)
              else if (id === 'new-window') openNewWindow()
              else if (id === 'toggle-controls')
                setShowTileControls(!showTileControls)
            }}
            onSelectSubmenu={(parentId: string, childId: string) => {
              if (parentId === 'theme') setTheme(childId)
            }}
            align="right"
            trigger={
              <Button variant="ghost" size="icon" title="App Options">
                <Palette size={16} />
              </Button>
            }
          />

          {/* Window controls (Linux/Windows only) */}
          {!isMac && (
            <>
              <div className="w-px h-4 bg-border/50 mx-1 shrink-0" />

              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => handleWindowAction('minimize')}
                  className="w-10 h-7 flex items-center justify-center hover:bg-accent text-muted-foreground hover:text-foreground transition-colors rounded-md"
                  title="Minimize"
                >
                  <Minus size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => handleWindowAction('maximize')}
                  className="w-10 h-7 flex items-center justify-center hover:bg-accent text-muted-foreground hover:text-foreground transition-colors rounded-md"
                  title={isMaximized ? 'Restore' : 'Maximize'}
                >
                  <Square size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => handleWindowAction('close')}
                  className="w-10 h-7 flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground text-muted-foreground transition-colors rounded-md"
                  title="Close"
                >
                  <X size={14} />
                </button>
              </div>
            </>
          )}
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
          }}
        />
      )}

      {showDeleteConfirm && (
        <Modal
          isOpen
          onClose={() => setShowDeleteConfirm(false)}
          title="Delete Workspace"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete workspace{' '}
              <span className="font-semibold text-foreground">
                {workspaceConfig.id}
              </span>
              ? This action cannot be undone.
            </p>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                className="flex-1 bg-destructive text-destructive-foreground hover:opacity-90"
                onClick={async () => {
                  setShowDeleteConfirm(false)
                  await deleteWorkspace(workspaceConfig.id)
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}

      <LayoutVibeModal
        isOpen={showVibeModal}
        onClose={() => setShowVibeModal(false)}
        onConfirm={(name, layout) => {
          addLayout(name, layout)
        }}
      />
    </>
  )
}

export default TitleBar
