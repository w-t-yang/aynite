/**
 * Hook for search bar state and a FileSearchBar component.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

export function useSearchBar() {
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeMatchIndex, setActiveMatchIndex] = useState(0)
  const [totalMatchCount, setTotalMatchCount] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [showSearch])

  useEffect(() => {
    setActiveMatchIndex(0)
  }, [])

  const handleSearchResult = useCallback((total: number) => {
    setTotalMatchCount(total)
  }, [])

  const nextMatch = useCallback(() => {
    setActiveMatchIndex((prev) =>
      totalMatchCount > 0 ? (prev + 1) % totalMatchCount : 0,
    )
  }, [totalMatchCount])

  const prevMatch = useCallback(() => {
    setActiveMatchIndex((prev) =>
      totalMatchCount > 0 ? (prev - 1 + totalMatchCount) % totalMatchCount : 0,
    )
  }, [totalMatchCount])

  const openSearch = useCallback(() => {
    setShowSearch(true)
    setSearchQuery('')
    setActiveMatchIndex(0)
  }, [])

  const closeSearch = useCallback(() => {
    setShowSearch(false)
    setSearchQuery('')
  }, [])

  return {
    showSearch,
    searchQuery,
    setSearchQuery,
    activeMatchIndex,
    setActiveMatchIndex,
    totalMatchCount,
    handleSearchResult,
    nextMatch,
    prevMatch,
    openSearch,
    closeSearch,
    searchInputRef,
  }
}
