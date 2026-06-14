import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppOperation } from '../../../lib/constants/app'
import type { LeafNode } from '../../../lib/constants/types'

import { Button } from '../../shared/basic/Button'
import { SelectionMenu } from '../../shared/featured/SelectionMenu'
import { useI18n } from '../../shared/i18n/useI18n'
import { cn } from '../../shared/lib/utils'
import { useApp } from '../AppContext'

interface TileProps {
  node: LeafNode
}

const SHORTCUTS = [
  { keys: 'Ctrl + -', actionKey: 'tile.splitVertical' },
  { keys: 'Ctrl + =', actionKey: 'tile.splitHorizontal' },
  { keys: 'Ctrl + Q', actionKey: 'tile.closeTile' },
  { keys: 'Ctrl + O', actionKey: 'tile.cycleTiles' },
  { keys: 'Ctrl + R', actionKey: 'tile.refreshTile' },
]

const Tile: React.FC<TileProps> = ({ node }) => {
  const {
    activeTileId,
    setActiveTileId,
    executeAppOperation,
    updateTileView,
    availableViews,
    isResizing,
    showTileControls,
    locale,
  } = useApp()
  const { t } = useI18n(locale)
  const { id, name, size } = node
  const isActive = activeTileId === id
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [loaded, setLoaded] = useState(false)
  const loadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const viewOptions = useMemo(
    () => availableViews.map((v) => ({ id: v.id, label: v.name })),
    [availableViews],
  )

  const handleSelectView = (selectedUrl: string) => {
    if (selectedUrl === 'close') {
      executeAppOperation(AppOperation.TILE_CLOSE)
    } else {
      setLoaded(false)
      if (loadTimerRef.current) clearTimeout(loadTimerRef.current)
      updateTileView(id, { name: selectedUrl })
    }
  }

  const menuItems = useMemo(
    () => [
      ...viewOptions,
      { id: 'divider-1', type: 'divider' },
      { id: 'close', label: t('tile.close'), className: 'text-destructive' },
    ],
    [viewOptions, t],
  )

  // Menu for empty tile — no close option since there's nothing to close
  const loadViewItems = useMemo(() => viewOptions, [viewOptions])

  const handleLoadView = (selectedUrl: string) => {
    setLoaded(false)
    if (loadTimerRef.current) clearTimeout(loadTimerRef.current)
    updateTileView(id, { name: selectedUrl })
  }

  const handleIframeLoad = useCallback(() => {
    loadTimerRef.current = setTimeout(() => setLoaded(true), 80)
  }, [])

  // Reset loading state when view name changes
  useEffect(() => {
    setLoaded(false)
    if (loadTimerRef.current) clearTimeout(loadTimerRef.current)
  }, [])

  const iframeSrc = name
    ? `aynite://${name}/index.html#tileId=${id}${node.data ? `&data=${encodeURIComponent(JSON.stringify(node.data))}` : ''}`
    : ''

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Tile container needs to catch clicks for activation
    <div
      id={id}
      role="presentation"
      className={cn(
        'tile relative group border-2',
        isActive ? 'border-primary' : 'border-tile-border',
        isResizing && 'pointer-events-none select-none',
      )}
      style={{ flex: `${size} 1 0%` }}
      onMouseDown={() => setActiveTileId(id)}
    >
      <div
        className={cn(
          'absolute top-2 right-2 z-layout transition-opacity',
          showTileControls ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
      >
        <SelectionMenu
          items={menuItems}
          activeId={name || ''}
          onSelect={handleSelectView}
          align="right"
          trigger={
            <Button
              variant="ghost"
              size="icon"
              title={t('tile.options')}
              className="bg-background/80 backdrop-blur-md border border-border/50 hover:border-primary/50"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                role="img"
                aria-label={t('tile.options')}
              >
                <circle cx="12" cy="12" r="1" />
                <circle cx="12" cy="5" r="1" />
                <circle cx="12" cy="19" r="1" />
              </svg>
            </Button>
          }
        />
      </div>

      <div className="tile-content h-full p-0 relative overflow-hidden bg-background">
        {name ? (
          <>
            {/* Loading overlay — shown before iframe has loaded */}
            <div
              className="absolute inset-0 flex items-center justify-center transition-opacity duration-300 pointer-events-none bg-background"
              style={{ opacity: loaded ? 0 : 1 }}
            >
              <div className="flex flex-col items-center gap-3">
                <div className="w-5 h-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                <span className="text-[10px] text-muted-foreground/50 font-medium tracking-wider uppercase">
                  {t('tile.loading')} {name}...
                </span>
              </div>
            </div>

            <iframe
              ref={iframeRef}
              key={iframeSrc}
              src={iframeSrc}
              onLoad={handleIframeLoad}
              className="w-full h-full border-none transition-opacity duration-300"
              style={{
                opacity: loaded ? 1 : 0,
                pointerEvents: isResizing ? 'none' : ('auto' as any),
              }}
              title={name}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              allow="clipboard-read; clipboard-write; fullscreen"
            />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-5 p-6">
            {/* Load View Button */}
            <SelectionMenu
              items={loadViewItems}
              onSelect={handleLoadView}
              align="center"
              trigger={
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 px-4 py-2 text-sm font-medium"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    role="img"
                    aria-label={t('tile.loadView')}
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  {t('tile.loadView')}
                </Button>
              }
              title={t('tile.availableViews')}
            />

            {/* Keyboard Shortcut Instructions */}
            <div className="space-y-1.5 max-w-[260px]">
              <div className="text-[11px] font-semibold text-muted-foreground/40 uppercase tracking-wider text-center mb-2">
                {t('tile.shortcuts')}
              </div>
              {SHORTCUTS.map((shortcut) => (
                <div
                  key={shortcut.keys}
                  className="flex items-center justify-between gap-4 text-xs"
                >
                  <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted/50 text-[10px] font-mono text-muted-foreground/70 whitespace-nowrap">
                    {shortcut.keys}
                  </kbd>
                  <span className="text-muted-foreground/50 text-[11px]">
                    {t(shortcut.actionKey)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Tile
