/**
 * Search bar UI component.
 *
 * Extracted from FileBrowserPage.tsx for cleanliness.
 */
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react'
import { Button } from '../../../shared/basic/Button'
import { Input } from '../../../shared/basic/Input'

interface FileSearchBarProps {
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  activeMatchIndex: number
  totalMatchCount: number
  onNextMatch: () => void
  onPrevMatch: () => void
  onClose: () => void
  searchInputRef: React.RefObject<HTMLInputElement | null>
}

export function FileSearchBar({
  searchQuery,
  onSearchQueryChange,
  activeMatchIndex,
  totalMatchCount,
  onNextMatch,
  onPrevMatch,
  onClose,
  searchInputRef,
}: FileSearchBarProps) {
  return (
    <div className="shrink-0 bg-sidebar border-b border-border flex items-center gap-2 px-3 py-1.5 select-none">
      <Search size={13} className="text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <Input
          ref={searchInputRef}
          unstyled
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          placeholder="Find in file…"
          className="w-full text-sm text-foreground placeholder:text-muted-foreground/40"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              onClose()
            } else if (e.key === 'Enter') {
              e.preventDefault()
              onNextMatch()
            }
          }}
        />
      </div>
      {searchQuery && (
        <span className="text-[11px] text-muted-foreground/50 shrink-0">
          {totalMatchCount > 0
            ? `${activeMatchIndex + 1} of ${totalMatchCount} matches`
            : 'No matches'}
        </span>
      )}

      {totalMatchCount > 0 && (
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            type="button"
            onClick={onPrevMatch}
            title="Previous match (Ctrl+P)"
            className="p-0.5 size-auto"
          >
            <ChevronUp size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            onClick={onNextMatch}
            title="Next match (Ctrl+N)"
            className="p-0.5 size-auto"
          >
            <ChevronDown size={14} />
          </Button>
        </div>
      )}

      <Button
        variant="ghost"
        size="icon"
        type="button"
        onClick={onClose}
        className="ml-0.5"
      >
        <X size={13} />
      </Button>
    </div>
  )
}
