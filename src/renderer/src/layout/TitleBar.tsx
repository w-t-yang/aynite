import { Moon, Sun } from 'lucide-react'
import type React from 'react'
import { useMemo, useState } from 'react'
import { FLEX_CENTER_GAP_1 } from '../../../lib/constants/renderer/styles'
import { Button } from '../../shared/basic/Button'
import { FormModal } from '../../shared/featured/FormModal'
import { SelectionMenu } from '../../shared/featured/SelectionMenu'
import { useApp } from '../AppContext'

const TitleBar: React.FC = () => {
  const {
    workspaceConfig,
    workspaces,
    switchWorkspace,
    addWorkspace,
    switchLayout,
    themes,
    activeTheme,
    setTheme,
  } = useApp()
  const [showAddWorkspaceModal, setShowAddWorkspaceModal] = useState(false)

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
      })),
    [themes],
  )

  if (!workspaceConfig) return null

  return (
    <>
      <div className="h-9 flex items-center justify-between bg-sidebar/80 backdrop-blur-md border-b border-border select-none drag px-2 relative z-layout">
        {/* Left: Layout switcher (dynamic from workspace config) */}
        <div className="flex items-center gap-1 no-drag">
          {workspaceConfig.layouts.map((layout) => (
            <Button
              key={layout.id}
              variant={
                workspaceConfig.activeLayoutId === layout.id
                  ? 'secondary'
                  : 'ghost'
              }
              size="sm"
              onClick={() => switchLayout(layout.id)}
              title={layout.name}
            >
              {layout.name}
            </Button>
          ))}
        </div>

        {/* Center: Workspace switcher */}
        <div className="flex-1 flex justify-center items-center no-drag">
          <SelectionMenu
            activeId={workspaceConfig.id}
            items={workspaceOptions}
            onSelect={switchWorkspace}
            divided={false}
            align="center"
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
            }
          />
        </div>

        {/* Right: Theme switcher + branding */}
        <div className="flex items-center gap-1 no-drag">
          <SelectionMenu
            activeId={activeTheme?.id}
            items={themeOptions}
            onSelect={setTheme}
            divided={false}
            align="right"
            trigger={
              <Button variant="ghost" size="icon" title="Change Theme">
                {activeTheme?.type === 'light' ? (
                  <Sun size={16} />
                ) : (
                  <Moon size={16} />
                )}
              </Button>
            }
            title="Themes"
          />

          <div className="flex items-center gap-2 px-3 py-1 border-l border-border ml-1">
            <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em]">
              Aynite
            </span>
          </div>
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
    </>
  )
}

export default TitleBar
