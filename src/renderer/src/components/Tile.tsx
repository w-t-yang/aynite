import React from 'react'
import { useRef } from 'react'
import { LeafNode } from '../../../lib/constants/types'
import { AppOperation } from '../../../lib/constants/app'

import { Button } from '../../shared/basic/Button'
import { useApp } from '../context/AppContext'
import { ViewParentProvider } from '../context/ViewParentContext'

interface TileProps {
  node: LeafNode
}

const Tile: React.FC<TileProps> = ({ node }) => {
  const { activeTileId, setActiveTileId, executeAppOperation } = useApp()
  const { id, content: title, size, url } = node
  const isActive = activeTileId === id
  const iframeRef = useRef<HTMLIFrameElement>(null)

  return (
    <div
      id={id}
      className={`tile relative group ${isActive ? 'border-accent ring-1 ring-accent/30' : 'opacity-80'}`}
      style={{ flex: `${size} 1 0%` }}
      onMouseDown={() => setActiveTileId(id)}
    >
      {/* Close button, visible on hover */}
      <div className="absolute top-2 right-2 z-50 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => executeAppOperation(AppOperation.TILE_CLOSE)}
          title="Close tile"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </Button>
      </div>

      <div className="tile-content h-full p-0 relative overflow-hidden bg-tile-bg/50">
        {url ? (
          <ViewParentProvider id={id} iframeRef={iframeRef}>
            <iframe
              ref={iframeRef}
              src={url}
              className="w-full h-full border-none"
              title={title}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              allow="clipboard-read; clipboard-write"
            />
          </ViewParentProvider>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12 mb-2 opacity-10"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
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
