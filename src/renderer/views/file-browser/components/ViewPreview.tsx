import { useMemo } from 'react'

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
  const src = useMemo(() => {
    const params = new URLSearchParams()
    params.set('file', filePath)
    params.set('preview', '1')
    return `aynite://${viewName}/index.html#${params.toString()}`
  }, [viewName, filePath])

  return (
    <iframe
      src={src}
      className="w-full h-full border-none"
      title={`${viewName} preview`}
      sandbox="allow-scripts allow-same-origin allow-forms"
      allow="clipboard-read; clipboard-write"
    />
  )
}
