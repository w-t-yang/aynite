import {
  File,
  FileCode,
  FileImage,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { file } from '../../../bridge/file'
import { cn } from '../../../shared/lib/utils'

interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
}

interface FolderContentViewerProps {
  folderPath: string
  viewMode: 'grid' | 'list'
  onFileClick: (path: string) => void
  onFolderClick: (path: string) => void
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'json':
      return <FileJson size={16} />
    case 'js':
    case 'ts':
    case 'jsx':
    case 'tsx':
    case 'css':
    case 'html':
    case 'xml':
      return <FileCode size={16} />
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
      return <FileImage size={16} />
    case 'md':
    case 'txt':
    case 'log':
      return <FileText size={16} />
    default:
      return <File size={16} />
  }
}

const IGNORED_DIRS = new Set(['node_modules', '.git'])

function sortEntries(entries: FileEntry[]): FileEntry[] {
  return [...entries].sort((a, b) => {
    // Directories first
    if (a.isDirectory && !b.isDirectory) return -1
    if (!a.isDirectory && b.isDirectory) return 1
    // Then alphabetical
    return a.name.localeCompare(b.name)
  })
}

export function FolderContentViewer({
  folderPath,
  viewMode,
  onFileClick,
  onFolderClick,
}: FolderContentViewerProps) {
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    file
      .list(folderPath)
      .then((result) => {
        if (cancelled) return
        const filtered = result.filter(
          (e) => !IGNORED_DIRS.has(e.name) && !e.name.startsWith('.'),
        )
        setEntries(sortEntries(filtered))
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err?.message || 'Failed to load folder')
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [folderPath])

  const handleEntryClick = useCallback(
    (entry: FileEntry) => {
      if (entry.isDirectory) {
        onFolderClick(entry.path)
      } else {
        onFileClick(entry.path)
      }
    },
    [onFileClick, onFolderClick],
  )

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <div className="size-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span>Loading folder...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-destructive/70">{error}</p>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-muted-foreground/50 italic">Empty folder</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {viewMode === 'grid' ? (
        /* ── Grid layout ── */
        <div className="grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))] gap-3">
          {entries.map((entry) => (
            <button
              key={entry.path}
              type="button"
              onClick={() => handleEntryClick(entry)}
              className={cn(
                'flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-center',
                'hover:bg-accent/10 hover:border-border/60 cursor-pointer',
                entry.isDirectory
                  ? 'border-border/30 bg-accent/3'
                  : 'border-border/20 bg-transparent',
              )}
              title={entry.path}
            >
              <span className="opacity-70">
                {entry.isDirectory ? (
                  <FolderOpen size={22} />
                ) : (
                  getFileIcon(entry.name)
                )}
              </span>
              <span className="text-[10px] text-muted-foreground/70 leading-tight break-all line-clamp-2">
                {entry.name}
              </span>
            </button>
          ))}
        </div>
      ) : (
        /* ── List layout ── */
        <div className="flex flex-col">
          {entries.map((entry, index) => (
            <button
              key={entry.path}
              type="button"
              onClick={() => handleEntryClick(entry)}
              className={cn(
                'flex items-center gap-3 px-3 py-1.5 text-left transition-all',
                'hover:bg-accent/10 cursor-pointer rounded-md',
                index > 0 && 'border-t border-border/5',
              )}
              title={entry.path}
            >
              <span className="shrink-0 opacity-60">
                {entry.isDirectory ? (
                  <Folder size={14} />
                ) : (
                  getFileIcon(entry.name)
                )}
              </span>
              <span className="flex-1 truncate text-xs font-mono text-foreground/80">
                {entry.name}
              </span>
              <span className="shrink-0 text-[9px] text-muted-foreground/30 font-mono">
                {entry.isDirectory ? 'folder' : 'file'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
