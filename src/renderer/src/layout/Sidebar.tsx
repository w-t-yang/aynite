import {
  Code,
  FolderOpen,
  Headphones,
  Home,
  Layout,
  Rss,
  Settings,
} from 'lucide-react'
import type React from 'react'
import { useI18n } from '../../shared/i18n/useI18n'
import { cn } from '../../shared/lib/utils'
import { useApp } from '../AppContext'

const LAYOUT_ICONS: Record<string, typeof Layout> = {
  code: Code,
  layout: Layout,
  rss: Rss,
  spotify: Headphones,
}

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
      className="flex flex-col bg-sidebar/80 backdrop-blur-md select-none shrink-0 font-['Inter',ui-sans-serif,system-ui,sans-serif]"
      style={{ width: SIDEBAR_WIDTH, fontSize: '14px' }}
    >
      {/* System items: Home, Projects */}
      <div
        className="flex flex-col items-center pt-[12px] px-[8px]"
        style={{ gap: '4px' }}
      >
        {SYSTEM_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = isSystemActive(item.layoutId)
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => switchLayout(item.layoutId)}
              className={cn(
                'w-full flex flex-col items-center px-[4px] rounded-lg transition-all',
                isActive
                  ? 'text-muted-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
              )}
              style={{ gap: '4px', paddingTop: '6px', paddingBottom: '6px' }}
              title={t(`sidebar.${item.id}`)}
            >
              <div
                className={cn(
                  'flex items-center justify-center w-[40px] h-[40px] rounded-lg transition-all',
                  isActive && 'bg-primary/10 text-primary',
                )}
              >
                <Icon size={20} />
              </div>
              <span
                className="font-medium leading-tight text-center"
                style={{ fontSize: '10px' }}
              >
                {t(`sidebar.${item.id}`)}
              </span>
            </button>
          )
        })}
      </div>

      {/* User Layouts */}
      {userLayouts.length > 0 && (
        <div
          className="flex flex-col items-center px-[8px]"
          style={{ gap: '4px', marginTop: '8px' }}
        >
          {userLayouts.map((layout: any) => {
            const isActive = workspaceConfig?.activeLayoutId === layout.id
            const Icon = layout.icon
              ? LAYOUT_ICONS[layout.icon] || Layout
              : Layout
            return (
              <button
                key={layout.id}
                type="button"
                onClick={() => switchLayout(layout.id)}
                className={cn(
                  'w-full flex flex-col items-center px-[4px] rounded-lg transition-all',
                  isActive
                    ? 'text-muted-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
                )}
                style={{ gap: '4px', paddingTop: '6px', paddingBottom: '6px' }}
                title={layout.description || layout.name}
              >
                <div
                  className={cn(
                    'flex items-center justify-center w-[40px] h-[40px] rounded-lg transition-all',
                    isActive && 'bg-primary/10 text-primary',
                  )}
                >
                  <Icon size={18} />
                </div>
                <span
                  className="font-medium leading-tight text-center break-words"
                  style={{ fontSize: '9px', maxWidth: '60px' }}
                >
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
      <div className="flex flex-col items-center px-[8px] pb-[12px]">
        <button
          type="button"
          onClick={() => switchLayout('sys-settings')}
          className={cn(
            'w-full flex flex-col items-center px-[4px] rounded-lg transition-all',
            isSystemActive('sys-settings')
              ? 'text-muted-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
          )}
          style={{ gap: '4px', paddingTop: '6px', paddingBottom: '6px' }}
          title={t('sidebar.settings')}
        >
          <div
            className={cn(
              'flex items-center justify-center w-[40px] h-[40px] rounded-lg transition-all',
              isSystemActive('sys-settings') && 'bg-primary/10 text-primary',
            )}
          >
            <Settings size={20} />
          </div>
          <span
            className="font-medium leading-tight text-center"
            style={{ fontSize: '10px' }}
          >
            {t('sidebar.settings')}
          </span>
        </button>
      </div>
    </div>
  )
}

export default Sidebar
