import { FolderOpen, Home, Settings } from 'lucide-react'
import type React from 'react'
import { useI18n } from '../../shared/i18n/useI18n'
import { cn } from '../../shared/lib/utils'
import { useApp } from '../AppContext'

const NAV_ITEMS = [
  { id: 'home', icon: Home, viewName: 'home' },
  { id: 'projects', icon: FolderOpen, viewName: 'projects-view' },
] as const

const SIDEBAR_WIDTH = 72

const Sidebar: React.FC = () => {
  const { activeTileId, updateTileView, locale, workspaceConfig } = useApp()
  const { t } = useI18n(locale)

  // Determine which item is active by checking active tile's current view
  const activeLayout = workspaceConfig?.layouts.find(
    (l: any) => l.id === workspaceConfig.activeLayoutId,
  )
  const activeViewName = getActiveViewName(activeLayout?.layout, activeTileId)

  const handleNav = (viewName: string) => {
    if (!activeTileId) return
    updateTileView(activeTileId, { name: viewName })
  }

  const openSettings = () => {
    if (!activeTileId) return
    updateTileView(activeTileId, { name: 'settings' })
  }

  return (
    <div
      className="flex flex-col bg-sidebar/80 backdrop-blur-md border-r border-border select-none shrink-0"
      style={{ width: SIDEBAR_WIDTH }}
    >
      {/* Top items: Home, Projects */}
      <div className="flex flex-col items-center gap-1 pt-3 px-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = activeViewName === item.viewName
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNav(item.viewName)}
              className={cn(
                'w-full flex flex-col items-center gap-1 py-2 px-1 rounded-lg transition-all',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
              )}
              title={t(`sidebar.${item.id}`)}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium leading-tight">
                {t(`sidebar.${item.id}`)}
              </span>
            </button>
          )
        })}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom item: Settings */}
      <div className="flex flex-col items-center px-2 pb-3">
        <button
          type="button"
          onClick={openSettings}
          className={cn(
            'w-full flex flex-col items-center gap-1 py-2 px-1 rounded-lg transition-all',
            activeViewName === 'settings'
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
          )}
          title={t('sidebar.settings')}
        >
          <Settings size={20} />
          <span className="text-[10px] font-medium leading-tight">
            {t('sidebar.settings')}
          </span>
        </button>
      </div>
    </div>
  )
}

/**
 * Traverses a layout node to find the view name of the active tile.
 */
function getActiveViewName(
  node: any,
  activeTileId: string | null,
): string | null {
  if (!node || !activeTileId) return null
  if (node.type === 'leaf') {
    if (node.id === activeTileId) {
      return node.name || null
    }
    return null
  }
  if (node.type === 'split' && node.children) {
    for (const child of node.children) {
      const result = getActiveViewName(child, activeTileId)
      if (result) return result
    }
  }
  return null
}

export default Sidebar
