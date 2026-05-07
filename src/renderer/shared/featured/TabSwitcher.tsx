import { FileText, Search, Settings as SettingsIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  type SelectionItem,
  SelectionList,
} from '../../shared/basic/SelectionList'
import { KeyManager } from '../lib/key-handlers'
import { FLEX_CENTER_GAP_1 } from '../lib/styles'

interface TabItem {
  id: string
  title: string
  filepath?: string
  type: string
}

interface TabSwitcherProps {
  tabs: TabItem[]
  activeTabId: string
  onSelect: (tabId: string) => void
  onOpenFile: (
    file: { name: string; path: string; isDirectory: boolean },
    content: string,
  ) => void
  onClose: () => void
}

// biome-ignore lint/correctness/noUnusedVariables: WIP component for future use
function TabSwitcherWIP({
  tabs,
  activeTabId,
  onSelect,
  onOpenFile,
  onClose,
}: TabSwitcherProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(() => {
    const activeIdx = tabs.findIndex((t) => t.id === activeTabId)
    return activeIdx >= 0 && tabs.length > 1 ? (activeIdx + 1) % tabs.length : 0
  })
  const [workspaceFiles, setWorkspaceFiles] = useState<any[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ;(async () => {
      const res = await window.aynite.workspaceAllFiles()
      if (res) setWorkspaceFiles(res)
    })()
  }, [])

  const openTabPaths = new Set(tabs.map((t) => t.filepath?.replace(/\\/g, '/')))

  const combinedItems = [
    ...tabs.map((t) => ({ ...t, isTab: true })),
    ...workspaceFiles
      .filter((f) => !openTabPaths.has(f.path.replace(/\\/g, '/')))
      .map((f) => ({
        id: f.path,
        title: f.name,
        filepath: f.path,
        type: 'file',
        isTab: false,
      })),
  ]

  const filtered = combinedItems
    .filter(
      (t) =>
        t.title.toLowerCase().includes(query.toLowerCase()) ||
        t.filepath?.toLowerCase().includes(query.toLowerCase()),
    )
    .slice(0, 30)

  const handleSelectItem = async (item: (typeof filtered)[0]) => {
    if (item.isTab) {
      onSelect(item.id)
    } else if (item.filepath) {
      const res = await window.aynite.readFile(item.filepath)
      if (res) {
        onOpenFile(
          { name: item.title, path: item.filepath, isDirectory: false },
          res,
        )
      }
    }
    onClose()
  }

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (query.trim() !== '') {
      setSelectedIndex(0)
    }
  }, [query])

  useEffect(() => {
    const api = {
      moveSelection: (dir: 'up' | 'down') => {
        setSelectedIndex(
          (prev) =>
            (dir === 'up' ? prev + filtered.length - 1 : prev + 1) %
            filtered.length,
        )
      },
      confirmSelection: async () => {
        const item = filtered[selectedIndex]
        if (item) handleSelectItem(item)
      },
    }

    KeyManager.registerTabSwitcher(api)
    return () => KeyManager.unregisterTabSwitcher()
    // biome-ignore lint/correctness/useExhaustiveDependencies: WIP unused component
  }, [filtered, selectedIndex, handleSelectItem])

  const selectionItems: SelectionItem[] = filtered.map((item) => ({
    id: item.id,
    label: item.title,
    subtitle: item.filepath,
    isActive: item.id === activeTabId,
    badge: item.isTab ? 'OPEN' : 'FILE',
    icon:
      item.type === 'settings' ? (
        <SettingsIcon size={16} />
      ) : (
        <FileText size={16} />
      ),
  }))

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: WIP unused
    // biome-ignore lint/a11y/noStaticElementInteractions: WIP unused
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        className="fixed inset-0 bg-black/50 backdrop-blur-sm cursor-default"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-3xl bg-sidebar border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Search input */}
        <div className="p-3 border-b border-border/50 bg-accent/10 flex items-center gap-3">
          <Search size={16} className="text-muted-foreground ml-1" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search open tabs..."
            className="w-full bg-transparent border-none focus:outline-none text-sm py-1 placeholder:text-muted-foreground/50"
          />
        </div>

        {/* Tab list */}
        <SelectionList
          items={selectionItems}
          selectedIndex={selectedIndex}
          onSelect={(selection) => {
            const item = filtered.find((f) => f.id === selection.id)
            if (item) handleSelectItem(item)
          }}
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
