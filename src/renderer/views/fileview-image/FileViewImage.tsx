import {
  ArrowLeftRight,
  ArrowUpDown,
  FileImage,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '../../shared/basic/Button'
import { type FileInfo, formatFileSize } from '../../shared/lib/file-handlers'
import { normalizePath } from '../../shared/lib/utils'

interface FileViewImageProps {
  file: FileInfo
}

const MIN_SCALE = 0.1
const MAX_SCALE = 5.0
const SCALE_STEP = 0.25
const DEFAULT_SCALE = 1

export function FileViewImage({ file }: FileViewImageProps) {
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [intrinsic, setIntrinsic] = useState<{ w: number; h: number } | null>(
    null,
  )
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Preload image to get intrinsic dimensions
  useEffect(() => {
    setScale(DEFAULT_SCALE)
    setIntrinsic(null)
    setLoaded(false)
    setError(false)

    const img = new Image()
    img.onload = () => {
      setIntrinsic({ w: img.naturalWidth, h: img.naturalHeight })
      setLoaded(true)
    }
    img.onerror = () => setError(true)
    img.src = `aynite-resource://${normalizePath(file.path)}`

    return () => {
      img.onload = null
      img.onerror = null
    }
  }, [file.path])

  // Auto-fit to viewport on initial load
  useEffect(() => {
    if (!intrinsic) return
    const container = containerRef.current
    if (!container) return
    const cw = container.clientWidth - 48
    const ch = container.clientHeight - 48
    if (cw <= 0 || ch <= 0) return
    const fitScale = Math.min(cw / intrinsic.w, ch / intrinsic.h)
    setScale(
      Math.max(MIN_SCALE, Math.min(MAX_SCALE, parseFloat(fitScale.toFixed(2)))),
    )
  }, [intrinsic])

  const zoomIn = useCallback(() => {
    setScale((s) =>
      Math.min(MAX_SCALE, parseFloat((s + SCALE_STEP).toFixed(2))),
    )
  }, [])

  const zoomOut = useCallback(() => {
    setScale((s) =>
      Math.max(MIN_SCALE, parseFloat((s - SCALE_STEP).toFixed(2))),
    )
  }, [])

  const fitToWidth = useCallback(() => {
    const container = containerRef.current
    if (!container || !intrinsic) return
    const w = container.clientWidth - 48
    const fitScale = w / intrinsic.w
    setScale(
      Math.max(MIN_SCALE, Math.min(MAX_SCALE, parseFloat(fitScale.toFixed(2)))),
    )
  }, [intrinsic])

  const fitToHeight = useCallback(() => {
    const container = containerRef.current
    if (!container || !intrinsic) return
    const h = container.clientHeight - 48
    const fitScale = h / intrinsic.h
    setScale(
      Math.max(MIN_SCALE, Math.min(MAX_SCALE, parseFloat(fitScale.toFixed(2)))),
    )
  }, [intrinsic])

  // ── Loading state ──────────────────────────────────────────────────────

  if (!loaded && !error) {
    return (
      <div className="h-full flex flex-col bg-background overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        </div>
      </div>
    )
  }

  // ── Error state ────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-background gap-4 p-8">
        <FileImage
          size={40}
          className="text-destructive/40"
          strokeWidth={1.5}
        />
        <div className="text-sm font-medium text-destructive">
          Could not load image
        </div>
      </div>
    )
  }

  // ── Main render ────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Toolbar */}
      <div className="shrink-0 h-10 bg-sidebar border-b border-border flex items-center justify-center px-3 gap-2 select-none">
        <Button
          variant="ghost"
          size="icon"
          onClick={zoomOut}
          disabled={scale <= MIN_SCALE}
          className="p-1 rounded"
          title="Zoom out"
        >
          <ZoomOut size={15} />
        </Button>

        <span className="text-[11px] text-muted-foreground/70 font-medium tabular-nums min-w-[36px] text-center">
          {Math.round(scale * 100)}%
        </span>

        <Button
          variant="ghost"
          size="icon"
          onClick={zoomIn}
          disabled={scale >= MAX_SCALE}
          className="p-1 rounded"
          title="Zoom in"
        >
          <ZoomIn size={15} />
        </Button>

        <div className="w-px h-5 bg-border/40 mx-1" />

        <Button
          variant="ghost"
          size="icon"
          onClick={fitToWidth}
          className="p-1 rounded"
          title="Fit to width"
        >
          <ArrowLeftRight size={15} />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={fitToHeight}
          className="p-1 rounded"
          title="Fit to height"
        >
          <ArrowUpDown size={15} />
        </Button>
      </div>

      {/* Content */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-auto bg-muted/20 p-6"
      >
        <div className="flex flex-col items-center gap-6 min-h-full justify-center">
          <img
            src={`aynite-resource://${normalizePath(file.path)}`}
            alt={file.name}
            className="shadow-xl rounded-sm bg-white h-auto"
            style={{ width: intrinsic?.w * scale }}
          />
          <div className="flex flex-col items-center gap-1 text-muted-foreground bg-sidebar/50 px-4 py-2 rounded-full border border-border/30">
            <span className="text-sm font-medium text-foreground">
              {file.name}
            </span>
            <span className="text-[10px] uppercase tracking-widest opacity-60">
              {formatFileSize(file.size)} • {file.extension} • {intrinsic?.w}×
              {intrinsic?.h}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
