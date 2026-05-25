import {
  ArrowLeftRight,
  ArrowUpDown,
  Video,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '../../shared/basic/Button'
import { type FileInfo, formatFileSize } from '../../shared/lib/file-handlers'

interface FileViewVideoProps {
  file: FileInfo
}

const MIN_SCALE = 0.1
const MAX_SCALE = 5.0
const SCALE_STEP = 0.25
const DEFAULT_SCALE = 1

function mimeType(ext: string): string {
  const map: Record<string, string> = {
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    mkv: 'video/x-matroska',
    ogg: 'video/ogg',
  }
  return map[ext] || 'video/mp4'
}

export function FileViewVideo({ file }: FileViewVideoProps) {
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [src, setSrc] = useState<string | null>(null)
  const [intrinsic, setIntrinsic] = useState<{ w: number; h: number } | null>(
    null,
  )
  const [_loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const urlRef = useRef<string | null>(null)

  // Load file as blob URL
  useEffect(() => {
    let cancelled = false
    setScale(DEFAULT_SCALE)
    setSrc(null)
    setIntrinsic(null)
    setLoaded(false)
    setError(false)

    const load = async () => {
      try {
        const data = await window.aynite.readFileBinary(file.path)
        if (cancelled) return
        const blob = new Blob([data], { type: mimeType(file.extension) })
        const url = URL.createObjectURL(blob)
        urlRef.current = url
        setSrc(url)
      } catch {
        if (!cancelled) setError(true)
      }
    }

    load()
    return () => {
      cancelled = true
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current)
        urlRef.current = null
      }
    }
  }, [file.path, file.extension])

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      setIntrinsic({ w: video.videoWidth, h: video.videoHeight })
    }
    setLoaded(true)
  }, [])

  const handleError = useCallback(() => {
    setError(true)
    setLoaded(true)
  }, [])

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

  // ── Loading state ──────────────────────────────────────────────────────

  if (!src && !error) {
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
        <Video size={40} className="text-destructive/40" strokeWidth={1.5} />
        <div className="text-sm font-medium text-destructive">
          Could not load video
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
          {/* biome-ignore lint/a11y/useMediaCaption: generic file viewer */}
          <video
            ref={videoRef}
            controls
            className="shadow-xl rounded-lg bg-black"
            src={src}
            onLoadedMetadata={handleLoadedMetadata}
            onError={handleError}
            style={
              intrinsic
                ? { width: intrinsic.w * scale }
                : { maxWidth: '100%', maxHeight: '70vh' }
            }
          />
          {intrinsic && (
            <div className="text-muted-foreground text-sm flex items-center gap-2 bg-sidebar/50 px-4 py-2 rounded-full border border-border/30">
              <Video size={14} /> {file.name} ({formatFileSize(file.size)}) •{' '}
              {intrinsic.w}×{intrinsic.h}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
