import { AlertTriangle, FileText, Folder, Terminal, Zap } from 'lucide-react'
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { type SelectionItem, SelectionList } from '../basic/SelectionList'

export interface SuggestionItem extends SelectionItem {
  name?: string
  isDirectory?: boolean
}

export interface SuggestionListProps {
  items: SuggestionItem[]
  command: (item: SuggestionItem) => void
  triggerChar: string
}

export interface SuggestionListHandle {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

/**
 * A specialized version of SelectionList used for Tiptap editor suggestions.
 * Includes keyboard navigation logic for the editor integration.
 */
export const SuggestionList = forwardRef<
  SuggestionListHandle,
  SuggestionListProps
>(({ items, command, triggerChar }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => setSelectedIndex(0), [])

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      const isCtrl = event.ctrlKey || event.metaKey

      if (
        event.key === 'ArrowUp' ||
        (isCtrl && event.key.toUpperCase() === 'P')
      ) {
        event.preventDefault()
        setSelectedIndex((prev) => (prev + items.length - 1) % items.length)
        return true
      }
      if (
        event.key === 'ArrowDown' ||
        (isCtrl && event.key.toUpperCase() === 'N')
      ) {
        event.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % items.length)
        return true
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        if (items[selectedIndex]) {
          command(items[selectedIndex])
        }
        return true
      }
      return false
    },
  }))

  const triggerLabel =
    triggerChar === '@' ? 'Files' : triggerChar === '/' ? 'Skills' : 'Commands'

  const selectionItems: SelectionItem[] = items.map((item) => {
    let icon = <FileText size={14} />
    if (item.error) icon = <AlertTriangle size={14} className="text-warning" />
    else if (triggerChar === '/') icon = <Zap size={14} />
    else if (triggerChar === '>') icon = <Terminal size={14} />
    else if (item.isDirectory) icon = <Folder size={14} />

    return {
      ...item,
      label: item.name || item.label,
      subtitle: item.error ? `Error: ${item.error}` : item.subtitle,
      icon,
    }
  })

  return (
    <div className="suggestion-list bg-sidebar border border-border rounded-lg shadow-2xl overflow-hidden min-w-[280px] max-w-[480px] flex flex-col animate-in fade-in zoom-in-95 duration-100">
      <div className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 border-b border-border/30 bg-muted/20 shrink-0">
        {triggerLabel}
      </div>

      <SelectionList
        items={selectionItems}
        selectedIndex={selectedIndex}
        onSelect={(item) => command(item as SuggestionItem)}
        size="sm"
        className="max-h-[40vh]"
      />
    </div>
  )
})

SuggestionList.displayName = 'SuggestionList'
