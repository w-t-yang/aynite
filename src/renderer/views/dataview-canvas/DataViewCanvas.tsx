import { Excalidraw } from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import {
  AlertCircle,
  FolderOpen,
  RefreshCw,
  Save,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import '@excalidraw/excalidraw/index.css'
import { iconBtn, ViewHeader } from '../../shared/basic/ViewHeader'
import { validateJsonSchema } from '../../shared/lib/schema-validator'
import { useAppEvent, useView } from '../ViewContext'

function getThemeBg(): string {
  return (
    getComputedStyle(document.documentElement)
      .getPropertyValue('--background')
      .trim() || '#ffffff'
  )
}

export function DataViewCanvas() {
  const { themes, activeThemeId } = useView()
  const [error, setError] = useState<{
    message: string
    expected: string
  } | null>(null)
  const [viewConfig, setViewConfig] = useState<any>(null)
  const excRef = useRef<ExcalidrawImperativeAPI | null>(null)
  const currentFile = useRef<string | null>(null)

  const tileId = useMemo(() => {
    const hash = window.location.hash
    const match = hash.match(/tileId=([^&]+)/)
    return match ? match[1] : null
  }, [])

  // Parse initial file path from hash on mount
  const initialFilePath = useMemo(() => {
    const hash = window.location.hash.replace(/^#/, '')
    const params = new URLSearchParams(hash)
    let file = params.get('file')
    const dataParam = params.get('data')
    if (dataParam) {
      try {
        const tileData = JSON.parse(decodeURIComponent(dataParam))
        if (tileData.file) file = tileData.file
      } catch {
        /* ignore */
      }
    }
    return file
  }, [])

  // Load view config
  useEffect(() => {
    ;(window as any).aynite
      ?.getConfig('view-config', { view: 'dataview-canvas' })
      .then((cfg: any) => {
        if (cfg) setViewConfig(cfg)
      })
  }, [])

  const isPreview = useMemo(() => {
    const hash = window.location.hash.replace(/^#/, '')
    return new URLSearchParams(hash).get('preview') === '1'
  }, [])

  const currentTheme = themes.find((t) => t.id === activeThemeId)
  const isDark = currentTheme?.type === 'dark'

  // ─── Excalidraw background theming ─────────────────────────────────────
  const updateCanvasBg = useCallback(() => {
    const api = excRef.current
    if (!api) return
    const bg = getThemeBg()
    if (bg) api.updateScene({ appState: { viewBackgroundColor: bg } })
  }, [])

  useAppEvent('theme-changed', updateCanvasBg)

  useEffect(() => {
    if (themes.length > 0) updateCanvasBg()
  }, [themes, updateCanvasBg])

  // ─── Zoom handlers ──────────────────────────────────────────────────────
  const handleZoomIn = useCallback(() => {
    const api = excRef.current
    if (!api) return
    const zoom = api.getAppState().zoom
    const newVal = ((zoom.value as unknown as number) * 1.2) as any
    api.updateScene({ appState: { zoom: { value: newVal } } })
  }, [])

  const handleZoomOut = useCallback(() => {
    const api = excRef.current
    if (!api) return
    const zoom = api.getAppState().zoom
    const newVal = ((zoom.value as unknown as number) / 1.2) as any
    api.updateScene({ appState: { zoom: { value: newVal } } })
  }, [])

  // ─── File loading ──────────────────────────────────────────────────────
  const loadFile = useCallback(
    async (path: string) => {
      try {
        const content = await (window as any).aynite.readFile(path)
        const json = JSON.parse(content)

        // Validate against config schema if available
        if (viewConfig?.expected_file_type?.schema) {
          const { valid, errors } = validateJsonSchema(
            json,
            viewConfig.expected_file_type.schema,
          )
          if (!valid) {
            throw new Error(`Invalid canvas format: ${errors.join('; ')}`)
          }
        } else {
          // Fallback validation when config not loaded
          if (!json.elements || !Array.isArray(json.elements)) {
            throw new Error('Invalid canvas format: missing elements array')
          }
        }

        setError(null)
        currentFile.current = path
        const api = excRef.current
        if (api) {
          api.updateScene({
            elements: json.elements as any,
            appState: {
              ...(json.appState || {}),
              viewBackgroundColor: getThemeBg(),
            },
          })
        }
      } catch (err) {
        console.error('Failed to load canvas file:', err)
        const schemaStr = viewConfig?.expected_file_type?.schema
          ? JSON.stringify(viewConfig.expected_file_type.schema, null, 2)
          : '{ "elements": [...], "appState": {...} }'
        setError({
          message: `Failed to load file. File might be missing or invalid.`,
          expected: schemaStr,
        })
      }
    },
    [viewConfig?.expected_file_type?.schema],
  )

  // Load initial file when Excalidraw API becomes available
  const [excalidrawReady, setExcalidrawReady] = useState(false)

  useEffect(() => {
    if (!excalidrawReady || !initialFilePath) return
    loadFile(initialFilePath)
  }, [excalidrawReady, initialFilePath, loadFile])

  const handleSelectFile = async () => {
    try {
      const path = await (window as any).aynite.selectFile({
        title: 'Select Canvas JSON',
        filters: [{ name: 'JSON', extensions: ['json'] }],
      })
      if (path) {
        await loadFile(path)
        if (tileId) {
          ;(window as any).aynite.setConfig('tile-data', {
            tileId,
            data: { file: path },
          })
        }
      }
    } catch {
      const schemaStr = viewConfig?.expected_file_type?.schema
        ? JSON.stringify(viewConfig.expected_file_type.schema, null, 2)
        : '{ "elements": [...], "appState": {...} }'
      setError({
        message: 'Failed to select or parse file.',
        expected: schemaStr,
      })
    }
  }

  const handleRefresh = useCallback(() => {
    if (currentFile.current) {
      loadFile(currentFile.current)
    }
  }, [loadFile])

  const handleSave = useCallback(async () => {
    const api = excRef.current
    if (!api) return
    try {
      const path = await (window as any).aynite.saveFileDialog()
      if (!path) return
      const elements = api.getSceneElements()
      const appState = api.getAppState()
      const data = {
        type: 'excalidraw',
        version: 2,
        elements,
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
      await (window as any).aynite.writeFile(
        path,
        JSON.stringify(data, null, 2),
      )
    } catch (e) {
      console.error('Failed to save canvas:', e)
    }
  }, [])

  return (
    <div className="w-full h-full flex flex-col bg-background transition-colors overflow-hidden">
      <style>{`
        .excalidraw .dropdown-menu-button,
        .excalidraw .layer-ui__wrapper__top-right,
        .excalidraw .App-bottom-bar,
        .excalidraw .layer-ui__wrapper footer {
          display: none !important;
        }
      `}</style>
      {!isPreview && (
        <ViewHeader
          icon={
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="7.5" cy="7.5" r="1.5" />
              <path d="m3 16 4.5-4.5a1 1 0 0 1 1.4 0l3.6 3.6" />
              <path d="m14 12 1.5-1.5a1 1 0 0 1 1.4 0L21 16" />
            </svg>
          }
          title="Canvas"
        >
          <button
            type="button"
            onClick={handleZoomIn}
            className={iconBtn()}
            title="Zoom In"
          >
            <ZoomIn size={14} />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className={iconBtn()}
            title="Zoom Out"
          >
            <ZoomOut size={14} />
          </button>
          <button
            type="button"
            onClick={handleSave}
            className={iconBtn()}
            title="Save"
          >
            <Save size={14} />
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            className={iconBtn()}
            title="Reload"
          >
            <RefreshCw size={14} />
          </button>
          <button
            type="button"
            onClick={handleSelectFile}
            className={iconBtn()}
            title="Load canvas file"
          >
            <FolderOpen size={14} />
          </button>
        </ViewHeader>
      )}

      {/* Canvas Area */}
      <section className="flex-1 relative bg-background">
        <Excalidraw
          excalidrawAPI={(api) => {
            excRef.current = api
            const bg = getThemeBg()
            if (bg) api.updateScene({ appState: { viewBackgroundColor: bg } })
            setExcalidrawReady(true)
          }}
          theme={isDark ? 'dark' : 'light'}
          autoFocus={false}
          detectScroll={false}
          UIOptions={
            {
              canvasActions: {
                loadScene: false,
                saveToActiveFile: false,
                export: false,
                clearCanvas: false,
                saveAsImage: false,
                changeViewBackgroundColor: false,
              },
            } as any
          }
        />

        {/* Error Overlay */}
        {error && (
          <div className="absolute inset-0 z-modal flex items-center justify-center p-6 bg-background/80 backdrop-blur-sm">
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
