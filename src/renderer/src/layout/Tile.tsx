import React from 'react'
import { useRef, useEffect, useCallback } from 'react'
import { LeafNode } from '../../../lib/constants/types'
import { AppOperation } from '../../../lib/constants/app'

import { Button } from '../../shared/basic/Button'
import { SelectionMenu } from '../../shared/featured/SelectionMenu'
import { useApp } from '../context/AppContext'
import { useTheme } from '../context/ThemeContext'
import { cn, toCSSVar } from '../../shared/lib/utils'


interface TileProps {
  node: LeafNode
}

const Tile: React.FC<TileProps> = ({ node }) => {
  const { activeTileId, setActiveTileId, executeAppOperation, updateTileView, availableViews, isResizing } = useApp()
  const { activeTheme } = useTheme()
  const { id, content: title, size, url } = node
  const isActive = activeTileId === id
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const viewOptions = availableViews.map(v => ({ id: v.id, label: v.name }))

  const handleSelectView = (selectedUrl: string) => {
    console.log(`[Tile] handleSelectView: ${selectedUrl} for tile ${id}`);
    if (selectedUrl === 'close') {
      executeAppOperation(AppOperation.TILE_CLOSE)
    } else {
      const view = viewOptions.find(v => v.id === selectedUrl)
      console.log(`[Tile] updating tile ${id} to ${selectedUrl}`);
      updateTileView(id, { url: selectedUrl, content: view?.label || 'New View' })
    }
  }


  const menuItems = [
    ...viewOptions,
    { id: 'divider-1', type: 'divider' },
    { id: 'close', label: 'Close Tile', className: 'text-destructive' }
  ]

  // ── Theme injection into iframe ──────────────────────────────────
  const injectThemeIntoIframe = useCallback(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    try {
      const iframeDoc = iframe.contentDocument
      if (!iframeDoc || !activeTheme) return

      const cssVars: string[] = []
      for (const [key, value] of Object.entries(activeTheme.colors)) {
        const kebabKey = key.replace(/([A-Z])/g, '-$1').toLowerCase()
        cssVars.push(`--${kebabKey}: ${value} !important;`)
        cssVars.push(`--color-${kebabKey}: ${value} !important;`)
      }

      if (activeTheme.fonts) {
        if (activeTheme.fonts.fontFamily) cssVars.push(`--font-sans: ${activeTheme.fonts.fontFamily} !important;`)
        if (activeTheme.fonts.fontMono) cssVars.push(`--font-mono: ${activeTheme.fonts.fontMono} !important;`)
        if (activeTheme.fonts.fontSize) {
          cssVars.push(`--font-size-base: ${activeTheme.fonts.fontSize} !important;`)
        }
      }

      const css = `
        :root { 
          ${cssVars.join('\n          ')} 
        }
        html, body {
          background-color: var(--card) !important;
          color: var(--foreground) !important;
          color-scheme: ${activeTheme.type} !important;
        }
        #root {
          background-color: transparent !important;
        }
      `

      let styleEl = iframeDoc.getElementById('aynite-theme-injection') as HTMLStyleElement
      if (!styleEl) {
        styleEl = iframeDoc.createElement('style')
        styleEl.id = 'aynite-theme-injection'
        iframeDoc.head.appendChild(styleEl)
      }
      styleEl.textContent = css

      // Also set the data-theme attribute for CSS selectors
      iframeDoc.documentElement.setAttribute('data-theme', activeTheme.type)
      
    } catch (e) {
      console.error('[Tile] Theme injection failed:', e)
    }
  }, [activeTheme])

  // Inject theme when iframe loads
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe || !url) return

    const handleLoad = () => injectThemeIntoIframe()
    
    // Initial check in case it's already loaded
    if (iframe.contentDocument?.readyState === 'complete') {
      handleLoad()
    }
    
    iframe.addEventListener('load', handleLoad)
    return () => iframe.removeEventListener('load', handleLoad)
  }, [url, injectThemeIntoIframe])

  // Re-inject theme when activeTheme changes
  useEffect(() => {
    if (!url || !iframeRef.current) return
    // Small delay to ensure parent state is settled
    const timer = setTimeout(() => injectThemeIntoIframe(), 50)
    return () => clearTimeout(timer)
  }, [activeTheme, injectThemeIntoIframe])


  return (
    <div
      id={id}
      className={cn(
        'tile relative group border-2',
        isActive
          ? 'border-primary z-10'
          : 'border-tile-border'
      )}
      style={{ flex: `${size} 1 0%` }}
      onMouseDown={() => setActiveTileId(id)}
    >

      <div 
        className={cn(
          "absolute top-2 right-2 z-50 transition-opacity",
          url ? "opacity-0 hover:opacity-100" : "opacity-100"
        )}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
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
              src={url}
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
