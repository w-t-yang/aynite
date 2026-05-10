import React, { useEffect, useRef, useState } from 'react'
import type { SelectionItem } from '../../../lib/types/ui'
import { cn } from '../lib/utils'

export type { SelectionItem }

interface SelectionListProps {
  items: SelectionItem[]
  selectedIndex: number
  onSelect: (item: SelectionItem) => void
  onSelectSubmenu?: (parentId: string, childId: string) => void
  className?: string
  itemClassName?: string
  labelClassName?: string
  subtitleClassName?: string
  divided?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function SelectionList({
  items,
  selectedIndex,
  onSelect,
  onSelectSubmenu,
  className,
  itemClassName,
  labelClassName = 'text-xs',
  subtitleClassName = 'text-xxs',
  divided = true,
  size = 'md',
}: SelectionListProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const [openSubmenuId, setOpenSubmenuId] = useState<string | null>(null)
  const [submenuRect, setSubmenuRect] = useState<DOMRect | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const sizeClasses = {
    sm: 'px-2 py-1 gap-2',
    md: 'px-3 py-1.5 gap-3',
    lg: 'px-4 py-2.5 gap-4',
  }

  const labelSizeClasses = {
    sm: 'text-[11px]',
    md: 'text-xs',
    lg: 'text-sm',
  }

  useEffect(() => {
    const selectedEl = listRef.current?.children[selectedIndex] as HTMLElement
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  // Close submenu on click outside
  useEffect(() => {
    if (!openSubmenuId) return
    const handleClick = () => setOpenSubmenuId(null)
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [openSubmenuId])

  const handleSubmenuEnter = (itemId: string, rect: DOMRect) => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    setOpenSubmenuId(itemId)
    setSubmenuRect(rect)
  }

  const handleSubmenuLeave = () => {
    closeTimerRef.current = setTimeout(() => {
      setOpenSubmenuId(null)
      setSubmenuRect(null)
    }, 150)
  }

  if (items.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-xs text-muted-foreground italic">
        No results
      </div>
    )
  }

  return (
    <div
      ref={listRef}
      className={cn('overflow-y-auto py-1 scrollbar-thin', className)}
    >
      {items.map((item, index) => {
        const isSelected = index === selectedIndex
        const hasSubmenu = item.submenu && item.submenu.length > 0
        const isSubmenuOpen = openSubmenuId === item.id

        if (item.type === 'divider') {
          return (
            <div
              key={item.id}
              className="h-px bg-border/40 my-1 mx-1 shrink-0"
            />
          )
        }

        return (
          <React.Fragment key={item.id}>
            {index > 0 && divided && items[index - 1]?.type !== 'divider' && (
              <div className="h-px bg-border/40 my-1 mx-1 shrink-0" />
            )}
            <button
              type="button"
              onClick={() => {
                if (hasSubmenu) return
                onSelect(item)
              }}
              onMouseEnter={(e) => {
                if (hasSubmenu) {
                  handleSubmenuEnter(
                    item.id,
                    e.currentTarget.getBoundingClientRect(),
                  )
                }
              }}
              onMouseLeave={() => {
                if (hasSubmenu) handleSubmenuLeave()
              }}
              className={cn(
                'w-full text-left transition-colors flex items-center group outline-none relative',
                sizeClasses[size],
                isSelected
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground hover:bg-primary/10 hover:text-primary',
                itemClassName,
              )}
            >
              {item.icon && (
                <span
                  className={cn(
                    'shrink-0 opacity-70',
                    isSelected ? 'opacity-100' : 'group-hover:opacity-100',
                  )}
                >
                  {item.icon}
                </span>
              )}
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      'truncate font-medium',
                      labelSizeClasses[size],
                      labelClassName,
                    )}
                  >
                    {item.label}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.badge && (
                      <span
                        className={cn(
                          'px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold uppercase tracking-wider',
                          isSelected
                            ? 'bg-primary-foreground/20 text-primary-foreground'
                            : 'bg-primary/10 text-primary',
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                    {item.isActive && (
                      <div
                        className={cn(
                          'w-1.5 h-1.5 rounded-full',
                          isSelected ? 'bg-primary-foreground' : 'bg-primary',
                        )}
                      />
                    )}
                    {hasSubmenu && (
                      <span
                        className={cn(
                          'text-muted-foreground text-xs',
                          isSelected && 'text-primary-foreground',
                        )}
                      >
                        {'›'}
                      </span>
                    )}
                  </div>
                </div>
                {item.subtitle && (
                  <span
                    className={cn(
                      'truncate opacity-50',
                      subtitleClassName,
                      isSelected
                        ? 'text-primary-foreground/70'
                        : 'text-muted-foreground',
                    )}
                  >
                    {item.subtitle}
                  </span>
                )}
              </div>
            </button>

            {hasSubmenu && isSubmenuOpen && submenuRect && (
              <SubmenuFlyout
                items={item.submenu ?? []}
                onSelect={
                  onSelectSubmenu
                    ? (childId: string) => onSelectSubmenu(item.id, childId)
                    : (childId: string) => {
                        // Fallback: call regular onSelect with child id
                        onSelect({ id: childId } as SelectionItem)
                      }
                }
                anchorRect={submenuRect}
                onMouseEnter={() => {
                  if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
                }}
                onMouseLeave={() => handleSubmenuLeave()}
              />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

function SubmenuFlyout({
  items,
  onSelect,
  anchorRect,
  onMouseEnter,
  onMouseLeave,
}: {
  items: SelectionItem[]
  onSelect: (childId: string) => void
  anchorRect: DOMRect
  onMouseEnter: () => void
  onMouseLeave: () => void
}) {
  const flyoutRef = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<React.CSSProperties>({})

  useEffect(() => {
    if (!flyoutRef.current) return
    const _flyout = flyoutRef.current

    const menuWidth = Math.min(200, window.innerWidth - anchorRect.right - 20)
    const menuHeight = items.length * 32 + 16

    let left = anchorRect.right + 4
    let top = anchorRect.top

    if (left + menuWidth > window.innerWidth - 8) {
      left = anchorRect.left - menuWidth - 4
    }

    if (top + menuHeight > window.innerHeight - 8) {
      top = Math.max(8, window.innerHeight - menuHeight - 8)
    }

    setStyle({
      position: 'fixed',
      left,
      top,
      zIndex: 4000,
      minWidth: menuWidth,
    })
  }, [anchorRect, items.length])

  return (
    <div
      ref={flyoutRef}
      style={style}
      role="menu"
      tabIndex={-1}
      className="bg-sidebar border border-border shadow-2xl rounded-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col ring-1 ring-black/5 py-1"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onSelect(item.id)
          }}
          className={cn(
            'w-full text-left transition-colors flex items-center gap-2 px-3 py-1.5 text-[11px] font-medium',
            'text-foreground hover:bg-primary/10 hover:text-primary',
            item.disabled && 'opacity-50 cursor-not-allowed',
          )}
          disabled={item.disabled}
        >
          {item.icon && (
            <span className="shrink-0 opacity-70">{item.icon}</span>
          )}
          <span className="truncate flex-1">{item.label}</span>
          {item.isActive && (
            <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
          )}
        </button>
      ))}
    </div>
  )
}
