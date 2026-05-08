import type React from 'react'
import { useRef } from 'react'
import { AppOperation } from '../../../lib/constants/app'
import type { LeafNode } from '../../../lib/constants/types'

import { Button } from '../../shared/basic/Button'
import { SelectionMenu } from '../../shared/featured/SelectionMenu'
import { cn } from '../../shared/lib/utils'
import { useApp } from '../AppContext'

interface TileProps {
  node: LeafNode
}

const Tile: React.FC<TileProps> = ({ node }) => {
  const {
    activeTileId,
    setActiveTileId,
    executeAppOperation,
    updateTileView,
    availableViews,
    isResizing,
  } = useApp()
  const { id, content: title, size, url } = node
  const isActive = activeTileId === id
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const viewOptions = availableViews.map((v) => ({ id: v.id, label: v.name }))

  const handleSelectView = (selectedUrl: string) => {
    console.log(`[Tile] handleSelectView: ${selectedUrl} for tile ${id}`)
    if (selectedUrl === 'close') {
      executeAppOperation(AppOperation.TILE_CLOSE)
    } else {
      const view = viewOptions.find((v) => v.id === selectedUrl)
      console.log(`[Tile] updating tile ${id} to ${selectedUrl}`)
      updateTileView(id, {
        url: selectedUrl,
        content: view?.label || 'New View',
      })
    }
  }

  const menuItems = [
    ...viewOptions,
    { id: 'divider-1', type: 'divider' },
    { id: 'close', label: 'Close Tile', className: 'text-destructive' },
  ]

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
          url ? 'opacity-0 hover:opacity-100' : 'opacity-100',
        )}
      >
        <SelectionMenu
          items={menuItems}
          activeId={url || ''}
          onSelect={handleSelectView}
          align="right"
          trigger={
            <Button
              variant="ghost"
              size="icon"
              title="Tile Options"
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
                aria-label="Tile options"
              >
                <circle cx="12" cy="12" r="1" />
                <circle cx="12" cy="5" r="1" />
                <circle cx="12" cy="19" r="1" />
              </svg>
            </Button>
          }
        />
      </div>

      <div className="tile-content h-full p-0 relative overflow-hidden">
        {url ? (
          <iframe
            ref={iframeRef}
            src={`${url}#tileId=${id}`}
            className="w-full h-full border-none"
            style={{ pointerEvents: isResizing ? 'none' : 'auto' }}
            title={title}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            allow="clipboard-read; clipboard-write"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12 mb-2 opacity-10"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              role="img"
              aria-label="Empty tile"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <div className="text-[13px] font-medium opacity-10">Empty Tile</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Tile
