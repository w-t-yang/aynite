import {
  ArrowLeftRight,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { FileInfo } from '../../../lib/types/files'
import { file as bridgeFile } from '../../bridge/file'
import { Button } from '../../shared/basic/Button'

// Register the pdfjs worker — Vite recognizes new URL with import.meta.url
GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

interface FileViewPdfProps {
  file: FileInfo
  content?: string
}

const MIN_SCALE = 0.5
const MAX_SCALE = 4.0
const SCALE_STEP = 0.25
const DEFAULT_SCALE = 1.5

export function FileViewPdf({ file }: FileViewPdfProps) {
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [numPages, setNumPages] = useState(0)
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isRenderingRef = useRef(false)

  // ── Load PDF document ──────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false

    const loadPdf = async () => {
      setLoading(true)
      setError(null)
      setPdfDoc(null)
      setCurrentPage(1)

      try {
        const data = await bridgeFile.readBinary(file.path)
        const pdf = await getDocument({ data }).promise
        if (cancelled) return
        setPdfDoc(pdf)
        setNumPages(pdf.numPages)
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load PDF')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadPdf()
    return () => {
      cancelled = true
    }
  }, [file.path])

  // ── Render current page ────────────────────────────────────────────────

  const renderPage = useCallback(async () => {
    const pdf = pdfDoc
    const canvas = canvasRef.current
    if (!pdf || !canvas) return

    // Wait for previous render to finish
    while (isRenderingRef.current) {
      await new Promise((resolve) => setTimeout(resolve, 10))
    }

    isRenderingRef.current = true

    try {
      const page: PDFPageProxy = await pdf.getPage(currentPage)

      const viewport = page.getViewport({ scale })

      // Handle device pixel ratio for sharp rendering
      const dpr = window.devicePixelRatio || 1
      canvas.width = viewport.width * dpr
      canvas.height = viewport.height * dpr
      canvas.style.width = `${viewport.width}px`
      canvas.style.height = `${viewport.height}px`

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.scale(dpr, dpr)

      // Background for the PDF page (uses canvas CSS, e.g. bg-white)
      ctx.fillStyle = window.getComputedStyle(canvas).backgroundColor
      ctx.fillRect(0, 0, viewport.width, viewport.height)

      await page.render({ canvas, viewport }).promise
      page.cleanup()
    } catch (renderErr: unknown) {
      // Silently ignore rendering errors during teardown
      if (renderErr instanceof Error && renderErr.message.includes('Worker')) {
        return
      }
      console.error('[FileViewPdf] Render error:', renderErr)
    } finally {
      isRenderingRef.current = false
    }
  }, [pdfDoc, currentPage, scale])

  useEffect(() => {
    renderPage()
  }, [renderPage])

  // ── Cleanup on unmount ─────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      pdfDoc?.cleanup()
      pdfDoc?.destroy()
    }
  }, [pdfDoc])

  // ── Handlers ───────────────────────────────────────────────────────────

  const goToPrevPage = useCallback(() => {
    setCurrentPage((p) => Math.max(1, p - 1))
  }, [])

  const goToNextPage = useCallback(() => {
    setCurrentPage((p) => Math.min(numPages, p + 1))
  }, [numPages])

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

  const fitToWidth = useCallback(async () => {
    const pdf = pdfDoc
    const container = containerRef.current
    if (!pdf || !container) return
    try {
      const page = await pdf.getPage(currentPage)
      const viewport = page.getViewport({ scale: 1 })
      const containerWidth = container.clientWidth - 48
      const fitScale = containerWidth / viewport.width
      setScale(
        Math.max(
          MIN_SCALE,
          Math.min(MAX_SCALE, parseFloat(fitScale.toFixed(2))),
        ),
      )
    } catch {
      // Silently ignore
    }
  }, [pdfDoc, currentPage])

  const fitToHeight = useCallback(async () => {
    const pdf = pdfDoc
    const container = containerRef.current
    if (!pdf || !container) return
    try {
      const page = await pdf.getPage(currentPage)
      const viewport = page.getViewport({ scale: 1 })
      const containerHeight = container.clientHeight - 48
      const fitScale = containerHeight / viewport.height
      setScale(
        Math.max(
          MIN_SCALE,
          Math.min(MAX_SCALE, parseFloat(fitScale.toFixed(2))),
        ),
      )
    } catch {
      // Silently ignore
    }
  }, [pdfDoc, currentPage])

  // ── Loading state ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background gap-4">
        <div className="w-6 h-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        <span className="text-xs text-muted-foreground/50 font-medium tracking-wider uppercase">
          Loading PDF...
        </span>
      </div>
    )
  }

  // ── Error state ────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background gap-4 p-8">
        <FileText size={40} className="text-destructive/40" strokeWidth={1.5} />
        <div className="text-sm font-medium text-destructive">
          Could not open PDF
        </div>
        <div className="text-xs text-muted-foreground/60 max-w-md text-center">
          {error}
        </div>
      </div>
    )
  }

  // ── Main render ────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Toolbar */}
      <div className="shrink-0 h-10 bg-sidebar border-b border-border flex items-center justify-center px-3 gap-2 select-none">
        {/* Page navigation */}
        <Button
          variant="ghost"
          size="icon"
          onClick={goToPrevPage}
          disabled={currentPage <= 1}
          className="p-1 rounded"
          title="Previous page"
        >
          <ChevronLeft size={15} />
        </Button>

        <span className="text-[11px] text-muted-foreground/70 font-medium tabular-nums min-w-[80px] text-center">
          Page {currentPage} / {numPages}
        </span>

        <Button
          variant="ghost"
          size="icon"
          onClick={goToNextPage}
          disabled={currentPage >= numPages}
          className="p-1 rounded"
          title="Next page"
        >
          <ChevronRight size={15} />
        </Button>

        {/* Separator */}
        <div className="w-px h-5 bg-border/40 mx-1" />

        {/* Zoom controls */}
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

        {/* Fit controls */}
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

      {/* Canvas area */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-auto bg-muted/20 p-6"
      >
        <canvas
          ref={canvasRef}
          className="shadow-xl rounded-sm bg-white block mx-auto"
        />
      </div>
    </div>
  )
}
