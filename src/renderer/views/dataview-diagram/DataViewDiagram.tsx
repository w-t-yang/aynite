import {
  AlertCircle,
  ArrowLeftRight,
  ArrowUpDown,
  FileType,
  FolderOpen,
  RefreshCw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import mermaid from 'mermaid'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { iconBtn, ViewHeader } from '../../shared/basic/ViewHeader'
import { validateJsonSchema } from '../../shared/lib/schema-validator'
import { useView } from '../ViewContext'
import type { DataViewDiagram } from './types'

// Initialize mermaid once
let initialized = false
function ensureMermaidInit(isDark: boolean) {
  if (!initialized) {
    mermaid.initialize({
      startOnLoad: false,
      theme: isDark ? 'dark' : 'default',
      securityLevel: 'loose',
      fontFamily: 'ui-monospace, monospace',
    })
    initialized = true
  }
}

export function DataViewDiagramView() {
  const { themes, activeThemeId } = useView()
  const [data, setData] = useState<DataViewDiagram | null>(null)
  const [error, setError] = useState<{
    message: string
    expected: string
  } | null>(null)
  const [viewConfig, setViewConfig] = useState<any>(null)
  const [svgHtml, setSvgHtml] = useState<string>('')
  const [renderError, setRenderError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const currentFile = useRef<string | null>(null)

  const [isRendering, setIsRendering] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const tileId = useMemo(() => {
    const hash = window.location.hash
    const match = hash.match(/tileId=([^&]+)/)
    return match ? match[1] : null
  }, [])

  const isPreview = useMemo(() => {
    const hash = window.location.hash.replace(/^#/, '')
    return new URLSearchParams(hash).get('preview') === '1'
  }, [])

  const currentTheme = themes.find((t) => t.id === activeThemeId)
  const isDark = currentTheme?.type === 'dark'

  // Load view config
  useEffect(() => {
    ;(window as any).aynite
      ?.getConfig('view-config', { view: 'dataview-diagram' })
      .then((cfg: any) => {
        if (cfg) setViewConfig(cfg)
      })
  }, [])

  const loadInitialFile = useCallback(
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
            throw new Error(`Invalid diagram format: ${errors.join('; ')}`)
          }
        } else if (!json.definition || typeof json.definition !== 'string') {
          throw new Error('Invalid diagram format: missing definition')
        }

        setError(null)
        setData(json)
        currentFile.current = path
      } catch (err) {
        console.error('Failed to load diagram file:', err)
        const schemaStr = viewConfig?.expected_file_type?.schema
          ? JSON.stringify(viewConfig.expected_file_type.schema, null, 2)
          : '{ "definition": "..." }'
        setError({
          message: `Failed to load file. File might be missing or invalid.`,
          expected: schemaStr,
        })
      }
    },
    [viewConfig?.expected_file_type?.schema],
  )

  const loadPlaybookFile = useCallback(async () => {
    try {
      const playbookPath = await (window as any).aynite.getConfig(
        'playbook-path',
      )
      if (!playbookPath) return
      const filePath = (window as any).aynite.joinPath(
        playbookPath,
        'aynite-architecture.json',
      )
      await loadInitialFile(filePath)
    } catch (err) {
      console.error('Failed to load playbook file:', err)
    }
  }, [loadInitialFile])

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
      loadPlaybookFile()
    }
  }, [loadInitialFile, loadPlaybookFile])

  const handleSelectFile = async () => {
    try {
      const path = await (window as any).aynite.selectFile({
        title: 'Select Diagram JSON',
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
      const schemaStr = viewConfig?.expected_file_type?.schema
        ? JSON.stringify(viewConfig.expected_file_type.schema, null, 2)
        : '{ "definition": "..." }'
      setError({
        message: 'Failed to select or parse file.',
        expected: schemaStr,
      })
    }
  }

  const handleRefresh = useCallback(() => {
    if (currentFile.current) {
      loadInitialFile(currentFile.current)
    } else {
      loadPlaybookFile()
    }
  }, [loadInitialFile, loadPlaybookFile])

  // Render diagram whenever data or theme changes
  useEffect(() => {
    if (!data) {
      setSvgHtml('')
      return
    }

    let cancelled = false
    setIsRendering(true)
    setRenderError(null)

    const render = async () => {
      try {
        ensureMermaidInit(isDark)
        const id = `mermaid-${Date.now()}`
        const { svg } = await mermaid.render(id, data.definition)
        if (!cancelled) {
          setSvgHtml(svg)
          setRenderError(null)
        }
      } catch (err) {
        console.error('Mermaid render error:', err)
        if (!cancelled) {
          setRenderError(
            err instanceof Error ? err.message : 'Failed to render diagram',
          )
          setSvgHtml('')
        }
      } finally {
        if (!cancelled) setIsRendering(false)
      }
    }

    render()
    return () => {
      cancelled = true
    }
  }, [data, isDark])

  return (
    <div className="w-full h-full flex flex-col bg-background transition-colors overflow-hidden">
      {/* Toolbar */}
      {!isPreview && (
        <ViewHeader icon={<FileType size={16} />} title="Diagram">
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
            title="Load diagram file"
          >
            <FolderOpen size={14} />
          </button>
        </ViewHeader>
      )}

      {/* Diagram Area */}
      <section
        ref={containerRef}
        className="flex-1 relative bg-background overflow-hidden"
        onWheel={(e) => {
          if (e.ctrlKey || e.metaKey) return
          const delta = -e.deltaY
          const scaleFactor = 1.08
          setZoom((z) =>
            Math.min(
              Math.max(delta > 0 ? z * scaleFactor : z / scaleFactor, 0.1),
              5,
            ),
          )
        }}
      >
        {data && (
          <div className="w-full h-full overflow-auto p-6">
            {data.title && (
              <h2 className="text-sm font-bold text-foreground mb-4">
                {data.title}
              </h2>
            )}

            {isRendering && (
              <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
                <RefreshCw size={14} className="animate-spin" />
                Rendering diagram...
              </div>
            )}

            {renderError && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 text-destructive mb-1">
                  <AlertCircle size={16} />
                  <span className="font-bold text-[11px]">Render Error</span>
                </div>
                <pre className="text-[10px] font-mono text-foreground/70 whitespace-pre-wrap mt-2">
                  {renderError}
                </pre>
                <p className="text-[10px] text-muted-foreground mt-2">
                  Check the diagram definition syntax.
                </p>
              </div>
            )}

            {svgHtml && !renderError && (
              <div className="min-w-full min-h-full">
                <div
                  className="inline-block transition-transform duration-200 origin-top-left"
                  style={{ transform: `scale(${zoom})` }}
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: intentional, rendering generated SVG
                  dangerouslySetInnerHTML={{ __html: svgHtml }}
                />
              </div>
            )}
          </div>
        )}

        {/* Bottom Controls */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-layout flex items-center gap-1 bg-popover/90 backdrop-blur-md border border-border rounded-full px-3 py-1.5 shadow-xl">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(z * 1.2, 5))}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
            title="Zoom In"
          >
            <ZoomIn size={14} />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(z / 1.2, 0.1))}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
            title="Zoom Out"
          >
            <ZoomOut size={14} />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
            title="Fit Width"
          >
            <ArrowLeftRight size={14} />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
            title="Fit Height"
          >
            <ArrowUpDown size={14} />
          </button>
        </div>

        {!data && (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <FileType size={48} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium opacity-40">
                Load a diagram JSON file to render
              </p>
            </div>
          </div>
        )}

        {/* Error Overlay */}
        {error && (
          <div className="absolute inset-0 z-modal flex items-center justify-center p-6 bg-background/80 backdrop-blur-sm">
            <div className="max-w-md w-full bg-popover border border-destructive/20 rounded-xl shadow-2xl p-6">
              <div className="flex items-center gap-3 text-destructive mb-4">
                <AlertCircle size={24} />
                <h3 className="font-bold">Diagram Load Error</h3>
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
