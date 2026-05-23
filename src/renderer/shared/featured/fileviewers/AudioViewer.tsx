import { Music } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { type FileInfo, formatFileSize } from '../../lib/file-handlers'

interface AudioViewerProps {
  file: FileInfo
}

function mimeType(ext: string): string {
  const map: Record<string, string> = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    flac: 'audio/flac',
    aac: 'audio/aac',
    m4a: 'audio/mp4',
    ogg: 'audio/ogg',
    opus: 'audio/ogg',
    wma: 'audio/x-ms-wma',
  }
  return map[ext] || 'audio/mpeg'
}

export function AudioViewer({ file }: AudioViewerProps) {
  const [src, setSrc] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const urlRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false

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

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-background gap-4 p-8">
        <Music size={40} className="text-destructive/40" strokeWidth={1.5} />
        <div className="text-sm font-medium text-destructive">
          Could not load audio
        </div>
      </div>
    )
  }

  if (!src) {
    return (
      <div className="h-full flex flex-col bg-background overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      <div className="flex-1 min-h-0 overflow-auto bg-muted/20 p-6">
        <div className="flex items-center justify-center min-h-full">
          <div className="bg-sidebar border border-border p-8 rounded-2xl shadow-xl flex flex-col items-center gap-6 w-96">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center animate-pulse">
              <Music size={32} className="text-primary" />
            </div>
            <div className="text-center">
              <h3 className="font-medium text-foreground mb-1 truncate w-64">
                {file.name}
              </h3>
              <p className="text-xs text-muted-foreground uppercase tracking-widest">
                {file.extension} • {formatFileSize(file.size)}
              </p>
            </div>
            {/* biome-ignore lint/a11y/useMediaCaption: generic file viewer */}
            <audio controls className="w-full" src={src} />
          </div>
        </div>
      </div>
    </div>
  )
}
