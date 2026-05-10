import { Excalidraw } from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { AlertCircle, Clipboard, Upload } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import '@excalidraw/excalidraw/index.css'
import { useView } from '../ViewContext'
import type { CanvasData } from './types'

const EXPECTED_FORMAT = `{
  "type": "excalidraw",
  "version": 2,
  "elements": [ ... ],
  "appState": { ... }
}`

export function CanvasPage() {
  const { themes, activeThemeId } = useView()
  const [data, setData] = useState<CanvasData | null>(null)
  const [error, setError] = useState<{
    message: string
    expected: string
  } | null>(null)
  const [copied, setCopied] = useState(false)
  const excRef = useRef<ExcalidrawImperativeAPI | null>(null)

  const tileId = useMemo(() => {
    const hash = window.location.hash
    const match = hash.match(/tileId=([^&]+)/)
    return match ? match[1] : null
  }, [])

  const currentTheme = themes.find((t) => t.id === activeThemeId)
  const isDark = currentTheme?.type === 'dark'

  const loadInitialFile = useCallback(async (path: string) => {
    try {
      const content = await (window as any).aynite.readFile(path)
      const json = JSON.parse(content)

      if (!json.elements || !Array.isArray(json.elements)) {
        throw new Error('Invalid canvas format: missing elements array')
      }

      setError(null)
      setData(json)
    } catch (err) {
      console.error('Failed to load canvas file:', err)
      setError({
        message: `Failed to load file. File might be missing or invalid.`,
        expected: EXPECTED_FORMAT,
      })
    }
  }, [])

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '')
    const params = new URLSearchParams(hash)
    let initialFile = params.get('file')
    const dataParam = params.get('data')

    if (dataParam) {
      try {
        const tileData = JSON.parse(decodeURIComponent(dataParam))
        if (tileData.file) initialFile = tileData.file
      } catch {
        /* ignore */
      }
    }

    if (initialFile) {
      loadInitialFile(initialFile)
    } else {
      // No mock data — start with empty canvas
      setData(null)
    }
  }, [loadInitialFile])

  const handleSelectFile = async () => {
    try {
      const path = await (window as any).aynite.selectFile({
        title: 'Select Canvas JSON',
        filters: [{ name: 'JSON', extensions: ['json'] }],
      })
      if (path) {
        await loadInitialFile(path)
        if (tileId) {
          ;(window as any).aynite.setConfig('tile-data', {
            tileId,
            data: { file: path },
          })
        }
      }
    } catch {
      setError({
        message: 'Failed to select or parse file.',
        expected: EXPECTED_FORMAT,
      })
    }
  }

  const handleExport = async () => {
    const api = excRef.current
    if (!api) return

    const elements = api.getSceneElements()
    const appState = api.getAppState()

    const exportData: CanvasData = {
      type: 'excalidraw',
      version: 2,
      elements: elements as CanvasData['elements'],
      appState: {
        viewBackgroundColor: appState.viewBackgroundColor,
        currentItemStrokeColor: appState.currentItemStrokeColor,
        currentItemBackgroundColor: appState.currentItemBackgroundColor,
        currentItemFillStyle: appState.currentItemFillStyle,
        currentItemStrokeWidth: appState.currentItemStrokeWidth,
        currentItemStrokeStyle: appState.currentItemStrokeStyle,
        currentItemRoughness: appState.currentItemRoughness,
        currentItemOpacity: appState.currentItemOpacity,
        currentItemFontFamily: appState.currentItemFontFamily,
        currentItemFontSize: appState.currentItemFontSize,
        currentItemTextAlign: appState.currentItemTextAlign,
        currentItemRoundness: appState.currentItemRoundness,
        gridSize: appState.gridSize,
      },
    }

    try {
      await navigator.clipboard.writeText(JSON.stringify(exportData, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      console.error('Failed to copy to clipboard:', e)
    }
  }

  return (
    <div className="w-full h-full flex flex-col bg-background transition-colors overflow-hidden">
      {/* Toolbar */}
      <div className="h-10 border-b border-border flex items-center px-4 gap-3 bg-muted/30 justify-between shrink-0 relative z-30">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-primary"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="7.5" cy="7.5" r="1.5" />
              <path d="m3 16 4.5-4.5a1 1 0 0 1 1.4 0l3.6 3.6" />
              <path d="m14 12 1.5-1.5a1 1 0 0 1 1.4 0L21 16" />
            </svg>
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
              Canvas
            </span>
          </div>
          <div className="h-4 w-px bg-border" />
          <button
            type="button"
            onClick={handleSelectFile}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors flex items-center gap-1.5"
          >
            <Upload size={14} />
            <span className="text-[10px] font-bold uppercase">Load Canvas</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors flex items-center gap-1.5"
          >
            {copied ? (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-success"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <Clipboard size={14} />
            )}
            <span className="text-[10px] font-bold uppercase">
              {copied ? 'Copied' : 'Export'}
            </span>
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <section className="flex-1 relative bg-background">
        <Excalidraw
          excalidrawAPI={(api) => {
            excRef.current = api
          }}
          initialData={
            data
              ? {
                  elements: data.elements as any,
                  appState: data.appState as any,
                }
              : undefined
          }
          theme={isDark ? 'dark' : 'light'}
          autoFocus={false}
          detectScroll={false}
        />

        {/* Error Overlay */}
        {error && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-background/80 backdrop-blur-sm">
            <div className="max-w-md w-full bg-popover border border-destructive/20 rounded-xl shadow-2xl p-6">
              <div className="flex items-center gap-3 text-destructive mb-4">
                <AlertCircle size={24} />
                <h3 className="font-bold">Canvas Load Error</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                {error.message}
              </p>
              <div className="bg-muted p-3 rounded font-mono text-[10px] mb-4 overflow-auto max-h-40 whitespace-pre">
                {error.expected}
              </div>
              <button
                type="button"
                onClick={handleSelectFile}
                className="w-full bg-primary text-primary-foreground py-2 rounded font-bold text-[11px]"
              >
                LOAD DIFFERENT FILE
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
