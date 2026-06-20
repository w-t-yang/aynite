import {
  Bug,
  ChevronLeft,
  ChevronRight,
  Languages,
  Minus,
  Moon,
  MoreHorizontal,
  Palette,
  Square,
  Sun,
  Trash2,
  X,
} from 'lucide-react'
import type React from 'react'
import { useMemo, useState } from 'react'
import { systemMutations } from '../../bridge/system'
import { platform } from '../../bridge/utils'
import { Button } from '../../shared/basic/Button'
import { Modal } from '../../shared/basic/Modal'
import { FormModal } from '../../shared/featured/FormModal'
import { SelectionMenu } from '../../shared/featured/SelectionMenu'
import { useI18n } from '../../shared/i18n/useI18n'
import { cn } from '../../shared/lib/utils'
import { useApp } from '../AppContext'
import { LayoutVibeModal } from './LayoutVibeModal'

const isMac = platform() === 'darwin'

const TitleBar: React.FC = () => {
  const {
    workspaceConfig,
    workspaces,
    switchWorkspace,
    addWorkspace,
    deleteWorkspace,
    addLayout,
    themes,
    activeTheme,
    setTheme,
    locale,
    setLocale,
    showTileControls,
    setShowTileControls,
    isMaximized,
    isFullscreen,
    navIndex,
    navHistory,
    navigateBack,
    navigateForward,
  } = useApp()
  const { t } = useI18n(locale)
  const [showAddWorkspaceModal, setShowAddWorkspaceModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showVibeModal, setShowVibeModal] = useState(false)

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

  const languageOptions = useMemo(
    () => [
      {
        id: 'en',
        label: t('language.en'),
        isActive: locale === 'en',
      },
      {
        id: 'zh',
        label: t('language.zh'),
        isActive: locale === 'zh',
      },
    ],
    [locale, t],
  )

  if (!workspaceConfig) return null

  const handleWindowAction = (action: 'minimize' | 'maximize' | 'close') => {
    switch (action) {
      case 'minimize':
        systemMutations.minimizeWindow()
        break
      case 'maximize':
        systemMutations.maximizeWindow()
        break
      case 'close':
        systemMutations.closeWindow()
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
        {/* Left: Workspace switcher + nav arrows */}
        <div className="flex items-center no-drag">
          <SelectionMenu
            activeId={workspaceConfig.id}
            items={workspaceOptions}
            onSelect={switchWorkspace}
            divided={false}
            align="left"
            menuClassName="min-w-[260px]"
            trigger={
              <Button
                variant="ghost"
                size="sm"
                className="min-w-[72px] px-3 flex items-center justify-center"
              >
                <span className="text-sm font-medium truncate">
                  {workspaceConfig.id}
                </span>
              </Button>
            }
            title={t('titlebar.workspaces')}
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
                  {t('titlebar.newWorkspace')}
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
                      {t('titlebar.deleteWorkspace')} ({workspaceConfig.id})
                    </Button>
                  </>
                )}
              </>
            }
          />

          {/* Navigation arrows */}
          <div className="flex items-center gap-0.5 ml-1">
            <button
              type="button"
              onClick={navigateBack}
              disabled={navIndex <= 0}
              className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors disabled:opacity-30 disabled:pointer-events-none"
              title="Back"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={navigateForward}
              disabled={navIndex >= navHistory.length - 1}
              className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors disabled:opacity-30 disabled:pointer-events-none"
              title="Forward"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Right: App options + Window controls */}
        <div className="flex items-center gap-1 no-drag shrink-0">
          <SelectionMenu
            items={[
              {
                id: 'theme',
                label: t('theme.label'),
                icon:
                  activeTheme?.type === 'light' ? (
                    <Sun size={14} />
                  ) : (
                    <Moon size={14} />
                  ),
                submenu: themeOptions,
              },
              { id: 'divider-lang', type: 'divider' },
              {
                id: 'language',
                label: t('language.label'),
                icon: <Languages size={14} />,
                submenu: languageOptions,
              },
              { id: 'divider-1', type: 'divider' },
              {
                id: 'toggle-controls',
                label: t('titlebar.showTileControls'),
                icon: <Palette size={14} />,
                isActive: showTileControls,
              },
              ...(import.meta.env.DEV
                ? [
                    { id: 'divider-2', type: 'divider' },
                    {
                      id: 'inspector',
                      label: t('titlebar.toggleInspector'),
                      icon: <Bug size={14} />,
                    },
                  ]
                : []),
            ]}
            onSelect={(id: string) => {
              if (id === 'toggle-controls')
                setShowTileControls(!showTileControls)
              else if (id === 'inspector') systemMutations.openDevTools()
            }}
            onSelectSubmenu={(parentId: string, childId: string) => {
              if (parentId === 'theme') setTheme(childId)
              else if (parentId === 'language')
                setLocale(childId as 'en' | 'zh')
            }}
            align="right"
            trigger={
              <Button
                variant="ghost"
                size="icon"
                title={t('titlebar.appOptions')}
              >
                <MoreHorizontal size={16} />
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
                  title={t('titlebar.minimize')}
                >
                  <Minus size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => handleWindowAction('maximize')}
                  className="w-10 h-7 flex items-center justify-center hover:bg-accent text-muted-foreground hover:text-foreground transition-colors rounded-md"
                  title={
                    isMaximized ? t('titlebar.restore') : t('titlebar.maximize')
                  }
                >
                  <Square size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => handleWindowAction('close')}
                  className="w-10 h-7 flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground text-muted-foreground transition-colors rounded-md"
                  title={t('titlebar.close')}
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
          title={t('workspace.createTitle')}
          label={t('workspace.nameLabel')}
          placeholder={t('workspace.namePlaceholder')}
          onSubmit={(name) => {
            addWorkspace(name)
          }}
        />
      )}

      {showDeleteConfirm && (
        <Modal
          isOpen
          onClose={() => setShowDeleteConfirm(false)}
          title={t('workspace.deleteTitle')}
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t('workspace.deleteConfirm')}{' '}
              <span className="font-semibold text-foreground">
                {workspaceConfig.id}
              </span>
              ? {t('workspace.deleteUndo')}
            </p>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowDeleteConfirm(false)}
              >
                {t('workspace.cancel')}
              </Button>
              <Button
                variant="primary"
                className="flex-1 bg-destructive text-destructive-foreground hover:opacity-90"
                onClick={async () => {
                  setShowDeleteConfirm(false)
                  await deleteWorkspace(workspaceConfig.id)
                }}
              >
                {t('workspace.delete')}
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
