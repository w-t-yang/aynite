import { useCallback, useMemo, useRef, useState } from 'react'

interface ViewPreviewProps {
  /** View name (directory name in ~/.aynite/views/) */
  viewName: string
  /** Absolute path to the file to preview */
  filePath: string
}

/**
 * Renders a view's content inside the file browser using a nested iframe.
 *
 * The iframe loads the view's HTML page with:
 *   - `file` param — absolute path to the file to render (URI encoded)
 *   - `preview=1` — signals the view to hide its header/toolbar
 *
 * The view reads the file via window.aynite.readFile() IPC bridge,
 * and the `aynite://` protocol resolves to ~/.aynite/views/[view]/.
 */
export function ViewPreview({ viewName, filePath }: ViewPreviewProps) {
  const [loaded, setLoaded] = useState(false)
  const loadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const src = useMemo(() => {
    const params = new URLSearchParams()
    params.set('file', filePath)
    params.set('preview', '1')
    return `aynite://${viewName}/index.html#${params.toString()}`
  }, [viewName, filePath])

  const handleLoad = useCallback(() => {
    // Small delay so the transition is perceivable — prevents flicker
    // when the iframe loads instantly from cache
    loadTimerRef.current = setTimeout(() => setLoaded(true), 80)
  }, [])

  // Reset loaded state when src changes (new file/view)
  useMemo(() => {
    setLoaded(false)
    if (loadTimerRef.current) clearTimeout(loadTimerRef.current)
  }, [])

  return (
    <div className="relative w-full h-full overflow-hidden bg-background">
      {/* Loading overlay — fades out when iframe loads */}
      <div
        className="absolute inset-0 flex items-center justify-center transition-opacity duration-300 pointer-events-none"
        style={{ opacity: loaded ? 0 : 1 }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-5 h-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          <span className="text-[10px] text-muted-foreground/50 font-medium tracking-wider uppercase">
            Loading {viewName}...
          </span>
        </div>
      </div>

      {/* Iframe — starts opaque, fades in once loaded */}
      <iframe
        src={src}
        onLoad={handleLoad}
        className="w-full h-full border-none transition-opacity duration-300"
        style={{ opacity: loaded ? 1 : 0 }}
        title={`${viewName} preview`}
        sandbox="allow-scripts allow-same-origin allow-forms"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  )
}
