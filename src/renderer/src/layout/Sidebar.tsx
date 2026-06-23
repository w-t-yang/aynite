import { FolderOpen, Home, Layout, Settings } from 'lucide-react'
import type React from 'react'
import { useI18n } from '../../shared/i18n/useI18n'
import { cn } from '../../shared/lib/utils'
import { useApp } from '../AppContext'

const SYSTEM_ITEMS = [
  { id: 'home', layoutId: 'sys-home', icon: Home },
  { id: 'projects', layoutId: 'sys-projects', icon: FolderOpen },
] as const

const SIDEBAR_WIDTH = 72

const Sidebar: React.FC = () => {
  const { switchLayout, locale, workspaceConfig } = useApp()
  const { t } = useI18n(locale)

  // User-created layouts (non-system)
  const userLayouts = (workspaceConfig?.layouts ?? []).filter(
    (l: any) => !l.system,
  )

  const isSystemActive = (layoutId: string) =>
    workspaceConfig?.activeLayoutId === layoutId

  return (
    <div
      className="flex flex-col bg-sidebar/80 backdrop-blur-md select-none shrink-0"
      style={{ width: SIDEBAR_WIDTH }}
    >
      {/* System items: Home, Projects */}
      <div className="flex flex-col items-center gap-1 pt-3 px-2">
        {SYSTEM_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = isSystemActive(item.layoutId)
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => switchLayout(item.layoutId)}
              className={cn(
                'w-full flex flex-col items-center gap-1 py-1.5 px-1 rounded-lg transition-all',
                isActive
                  ? 'text-muted-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
              )}
              title={t(`sidebar.${item.id}`)}
            >
              <div
                className={cn(
                  'flex items-center justify-center w-10 h-10 rounded-lg transition-all',
                  isActive && 'bg-primary/10 text-primary',
                )}
              >
                <Icon size={20} />
              </div>
              <span className="text-[10px] font-medium leading-tight">
                {t(`sidebar.${item.id}`)}
              </span>
            </button>
          )
        })}
      </div>

      {/* User Layouts */}
      {userLayouts.length > 0 && (
        <div className="flex flex-col items-center gap-1 mt-2 px-2">
          {userLayouts.map((layout: any) => {
            const isActive = workspaceConfig?.activeLayoutId === layout.id
            return (
              <button
                key={layout.id}
                type="button"
                onClick={() => switchLayout(layout.id)}
                className={cn(
                  'w-full flex flex-col items-center gap-1 py-1.5 px-1 rounded-lg transition-all',
                  isActive
                    ? 'text-muted-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
                )}
                title={layout.name}
              >
                <div
                  className={cn(
                    'flex items-center justify-center w-10 h-10 rounded-lg transition-all',
                    isActive && 'bg-primary/10 text-primary',
                  )}
                >
                  <Layout size={18} />
                </div>
                <span className="text-[9px] font-medium leading-tight text-center break-words max-w-[60px]">
                  {layout.name}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom item: Settings */}
      <div className="flex flex-col items-center px-2 pb-3">
        <button
          type="button"
          onClick={() => switchLayout('sys-settings')}
          className={cn(
            'w-full flex flex-col items-center gap-1 py-1.5 px-1 rounded-lg transition-all',
            isSystemActive('sys-settings')
              ? 'text-muted-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
          )}
          title={t('sidebar.settings')}
        >
          <div
            className={cn(
              'flex items-center justify-center w-10 h-10 rounded-lg transition-all',
              isSystemActive('sys-settings') && 'bg-primary/10 text-primary',
            )}
          >
            <Settings size={20} />
          </div>
          <span className="text-[10px] font-medium leading-tight">
            {t('sidebar.settings')}
          </span>
        </button>
      </div>
    </div>
  )
}

export default Sidebar
