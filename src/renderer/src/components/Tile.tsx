import React, { useEffect, useState } from 'react'
import { PROTOCOL } from '../../../lib/constants/app'
import { View, LeafNode } from '../../../lib/constants/types'

import { ayniteConfig } from '../config'
//import Dropdown from './shared/Dropdown'
import { useApp } from '../context/AppContext'

import { useRef } from 'react'
import { ViewParentProvider } from '../context/ViewParentContext'

interface TileProps {
  node: LeafNode
}

const Tile: React.FC<TileProps> = ({ node }) => {
  const { activeTileId, setActiveTileId, updateTileView } = useApp()
  const [registeredViews, setRegisteredViews] = useState<View[]>([])
  const { id, content: title, size, url } = node
  const isActive = activeTileId === id
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    ayniteConfig.getViews().then((dynamicViews: any) => {
      setRegisteredViews(dynamicViews)
    })
  }, [])

  const handleSelectView = (view: View) => {
    updateTileView(id, { url: `${PROTOCOL}://${view.path}` })
  }

  const handleClearView = () => {
    updateTileView(id, { url: '' })
  }

  const trigger = (
    <button
      className={`p-1.5 rounded-lg transition-all ${url
        ? 'opacity-0 hover:opacity-100 bg-black/40 backdrop-blur-md border border-white/10 text-white/60 hover:text-white'
        : 'opacity-100 bg-[#1e1e2e] border border-[#313244] text-[#a6adc8] hover:text-accent hover:border-accent'
        }`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
      </svg>
    </button>
  )

  return (
    <div
      id={id}
      className={`tile relative ${isActive ? 'border-accent ring-1 ring-accent/30' : 'opacity-80'}`}
      style={{ flex: `${size} 1 0%` }}
      onMouseDown={() => setActiveTileId(id)}
    >
      {/* Top Right Actions */}
      <div className="absolute top-2 right-2 z-50">
        {/*<Dropdown trigger={trigger} align="right">
        <div className="p-1.5 flex flex-col gap-0.5">
          <div className="px-3 py-1.5 text-[11px] font-bold text-[#585b70] uppercase tracking-wider">
            Views
          </div>
          {registeredViews.map((view) => (
            <button
              key={view.id}
              onClick={() => handleSelectView(view)}
              className="w-full px-3 py-2 text-left text-[13px] rounded-md hover:bg-accent/10 hover:text-accent transition-colors"
            >
              {view.id.charAt(0).toUpperCase() + view.id.slice(1)}
            </button>
          ))}
          {url && (
            <>
              <div className="h-px bg-[#313244] my-1" />
              <button
                onClick={handleClearView}
                className="w-full px-3 py-2 text-left text-[13px] rounded-md hover:bg-red-500/10 text-red-400/70 hover:text-red-400 transition-colors"
              >
                Clear View
              </button>
            </>
          )}
        </div>
      </Dropdown>*/}
      </div>

      <div className="tile-content h-full p-0 relative overflow-hidden bg-black/20">
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
          <div className="flex flex-col items-center justify-center h-full text-[#313244]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12 mb-2 opacity-20"
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
            <div className="text-[13px] font-medium opacity-20">Empty Tile</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Tile
