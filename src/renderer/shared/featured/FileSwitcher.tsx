import { FileText, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FLEX_CENTER_GAP_1 } from '../../../lib/constants/renderer/styles'
import { Input } from '../../shared/basic/Input'
import {
  type SelectionItem,
  SelectionList,
} from '../../shared/basic/SelectionList'
import { useApp } from '../../src/AppContext'
import { KeyManager } from '../lib/key-handlers'

export function FileSwitcher() {
  const { setShowFileSwitcher, activeFile, getAllFiles, setActiveFile } =
    useApp()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [files, setFiles] = useState<
    { name: string; path: string; isDirectory: boolean }[]
  >([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getAllFiles().then((res) => {
      if (res) setFiles(res)
    })
  }, [getAllFiles])

  const filtered = useMemo(() => {
    if (!query.trim()) {
      return files.slice(0, 30)
    }

    const q = query.toLowerCase()
    return files
      .map((f) => {
        const name = f.name.toLowerCase()
        const path = f.path.toLowerCase()
        let score = 0

        if (name === q) score += 100
        else if (name.startsWith(q)) score += 50
        else if (name.includes(q)) score += 30
        else if (path.includes(q)) score += 10

        return { ...f, score }
      })
      .filter((f) => f.score > 0)
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .slice(0, 30)
  }, [files, query])

  const handleSelect = useCallback(
    async (path: string) => {
      await setActiveFile(path)
      setShowFileSwitcher(false)
    },
    [setShowFileSwitcher, setActiveFile],
  )

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    setSelectedIndex(0)
  }, [])

  useEffect(() => {
    const api = {
      moveSelection: (dir: 'up' | 'down') => {
        setSelectedIndex((prev) => {
          if (filtered.length === 0) return 0
          return dir === 'up'
            ? (prev + filtered.length - 1) % filtered.length
            : (prev + 1) % filtered.length
        })
      },
      confirmSelection: () => {
        const item = filtered[selectedIndex]
        if (item) handleSelect(item.path)
      },
    }

    KeyManager.registerFileSwitcher(api)
    return () => KeyManager.unregisterFileSwitcher()
  }, [filtered, selectedIndex, handleSelect])

  const selectionItems: SelectionItem[] = filtered.map((f) => ({
    id: f.path,
    label: f.name,
    subtitle: f.path,
    isActive: f.path === activeFile,
    icon: <FileText size={16} />,
  }))

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-modal flex items-start justify-center pt-[15vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setShowFileSwitcher(false)
      }}
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm cursor-default" />

      {/* Panel */}
      <div className="relative z-layout w-full max-w-2xl bg-sidebar border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Search input */}
        <div className="p-3 border-b border-border/50 bg-accent/10 flex items-center gap-3">
          <Search size={16} className="text-muted-foreground ml-1" />
          <Input
            ref={inputRef}
            unstyled
            type="text"
            value={query}
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                e.preventDefault()
                // Auto-complete logic could go here, but for now we just handle it via KeyManager
              }
            }}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files..."
            className="w-full text-sm py-1"
          />
        </div>

        {/* File list */}
        <SelectionList
          items={selectionItems}
          selectedIndex={selectedIndex}
          onSelect={(item) => handleSelect(item.id)}
          className="max-h-[50vh]"
        />

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-border/30 flex items-center gap-4 text-[10px] text-muted-foreground/40 bg-muted/5">
          <div className={FLEX_CENTER_GAP_1}>
            <span className="px-1 py-0.5 rounded border border-border bg-accent/20">
              ↑↓
            </span>{' '}
            navigate
          </div>
          <div className={FLEX_CENTER_GAP_1}>
            <span className="px-1 py-0.5 rounded border border-border bg-accent/20">
              Enter
            </span>{' '}
            select
          </div>
          <div className={FLEX_CENTER_GAP_1}>
            <span className="px-1 py-0.5 rounded border border-border bg-accent/20">
              Esc
            </span>{' '}
            close
          </div>
        </div>
      </div>
    </div>
  )
}
