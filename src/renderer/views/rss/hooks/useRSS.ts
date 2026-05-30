import { useCallback, useEffect, useRef, useState } from 'react'
import { rss, rssMutations } from '../../../bridge/rss'
import type {
  RssBookmarks,
  RssConfig,
  RssContentStore,
  RssItem,
  RssSource,
} from '../types'

const STALE_MS = 24 * 60 * 60 * 1000 // 24 hours

interface RSSState {
  config: RssConfig | null
  contents: Record<string, RssContentStore>
  bookmarks: RssBookmarks
  loading: boolean
  fetching: boolean
  error: string | null
  selectedSourceId: string | null
  selectedItemId: string | null
  panelWidths: { sidebar: number; articleList: number }
}

export function useRSS() {
  const [state, setState] = useState<RSSState>({
    config: null,
    contents: {},
    bookmarks: {},
    loading: true,
    fetching: false,
    error: null,
    selectedSourceId: '__today__',
    selectedItemId: null,
    panelWidths: { sidebar: 220, articleList: 340 },
  })

  const autoFetchDone = useRef(false)

  const loadAll = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const [config, contents, bookmarks] = await Promise.all([
        rss.getConfig(),
        rss.getAllContents(),
        rss.getBookmarks(),
      ])
      setState((s) => ({
        ...s,
        config,
        contents,
        bookmarks,
        loading: false,
        error: null,
        panelWidths: {
          sidebar: config?.panelWidths?.sidebar ?? 220,
          articleList: config?.panelWidths?.articleList ?? 340,
        },
      }))

      // Auto-fetch stale sources
      if (config && !autoFetchDone.current) {
        autoFetchDone.current = true
        const stale = config.sources.filter((src: RssSource) => {
          const store = contents[src.id]
          if (!store) return true
          const lastFetched = src.lastFetchedAt || store.lastFetchedAt
          if (!lastFetched) return true
          const age = Date.now() - new Date(lastFetched).getTime()
          return age > STALE_MS
        })
        if (stale.length > 0) {
          setState((s) => ({ ...s, fetching: true }))
          for (const src of stale) {
            try {
              await rss.fetchFeed(src.id)
            } catch {
              /* individual fetch failure is non-fatal */
            }
          }
          const [freshConfig, freshContents] = await Promise.all([
            rss.getConfig(),
            rss.getAllContents(),
          ])
          setState((s) => ({
            ...s,
            config: freshConfig,
            contents: freshContents,
            fetching: false,
          }))
        }
      }
    } catch (e: any) {
      setState((s) => ({
        ...s,
        loading: false,
        error: e?.message || 'Failed to load RSS data',
      }))
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const savePanelWidths = useCallback(
    async (sidebar: number, articleList: number) => {
      setState((s) => ({ ...s, panelWidths: { sidebar, articleList } }))
      const config = state.config
      if (config) {
        config.panelWidths = { sidebar, articleList }
        await rssMutations.saveConfig(config)
      }
    },
    [state.config],
  )

  const selectSource = useCallback((sourceId: string | null) => {
    setState((s) => ({
      ...s,
      selectedSourceId: sourceId,
      selectedItemId: null,
    }))
  }, [])

  const selectToday = useCallback(() => {
    setState((s) => ({
      ...s,
      selectedSourceId: '__today__',
      selectedItemId: null,
    }))
  }, [])

  const selectItem = useCallback((itemId: string | null) => {
    setState((s) => ({ ...s, selectedItemId: itemId }))
  }, [])

  const getCurrentItems = useCallback((): RssItem[] => {
    const { config, contents, selectedSourceId } = state
    if (!config) return []

    if (selectedSourceId === '__today__') {
      const today = new Date()
      const todayStart = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
      ).getTime()
      const todayEnd = todayStart + 86_400_000 // end of today

      const all: RssItem[] = []
      for (const source of config.sources) {
        const store = contents[source.id]
        if (!store) continue
        for (const item of store.items) {
          const itemTime = new Date(item.pubDate).getTime()
          if (itemTime >= todayStart && itemTime < todayEnd) {
            all.push(item)
          }
        }
      }
      all.sort(
        (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime(),
      )
      return all
    }

    if (!selectedSourceId) {
      const all: RssItem[] = []
      for (const source of config.sources) {
        const store = contents[source.id]
        if (store) all.push(...store.items)
      }
      all.sort(
        (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime(),
      )
      return all
    }

    const store = contents[selectedSourceId]
    return store
      ? [...store.items].sort(
          (a, b) =>
            new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime(),
        )
      : []
  }, [state])

  const getBookmarkedItems = useCallback((): RssItem[] => {
    const { config, contents, bookmarks } = state
    if (!config) return []

    const items: RssItem[] = []
    const bookmarkIds = new Set(Object.keys(bookmarks))
    for (const source of config.sources) {
      const store = contents[source.id]
      if (store) {
        for (const item of store.items) {
          if (bookmarkIds.has(item.id)) items.push(item)
        }
      }
    }
    items.sort(
      (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime(),
    )
    return items
  }, [state])

  const getSelectedItem = useCallback((): RssItem | null => {
    if (!state.selectedItemId || !state.config) return null
    // Search in all sources (needed for __today__ mode where items come from multiple sources)
    const { config, contents } = state
    for (const source of config.sources) {
      const store = contents[source.id]
      if (store) {
        const found = store.items.find(
          (i: RssItem) => i.id === state.selectedItemId,
        )
        if (found) return found
      }
    }
    return null
  }, [state])

  const fetchAll = useCallback(async () => {
    setState((s) => ({ ...s, fetching: true }))
    try {
      await rss.fetchAll()
      await loadAll()
    } catch (e: any) {
      setState((s) => ({ ...s, error: e?.message, fetching: false }))
    }
  }, [loadAll])

  const fetchSource = useCallback(async (sourceId: string) => {
    setState((s) => ({ ...s, fetching: true }))
    try {
      await rss.fetchFeed(sourceId)
      const [config, contents] = await Promise.all([
        rss.getConfig(),
        rss.getAllContents(),
      ])
      setState((s) => ({ ...s, config, contents, fetching: false }))
    } catch (e: any) {
      setState((s) => ({ ...s, error: e?.message, fetching: false }))
    }
  }, [])

  const markRead = useCallback(
    async (itemId: string) => {
      const { config, contents, selectedSourceId } = state
      // For __today__ or null source, find which source the item belongs to
      const actualSourceId =
        selectedSourceId && selectedSourceId !== '__today__'
          ? selectedSourceId
          : null

      if (!actualSourceId) {
        // Search all sources for this item
        if (!config) return
        for (const source of config.sources) {
          const store = contents[source.id]
          if (store?.items.some((i: RssItem) => i.id === itemId)) {
            setState((s) => {
              const target = s.contents[source.id]
              if (!target) return s
              return {
                ...s,
                contents: {
                  ...s.contents,
                  [source.id]: {
                    ...target,
                    items: target.items.map((i: RssItem) =>
                      i.id === itemId ? { ...i, isRead: true } : i,
                    ),
                  },
                },
              }
            })
            await rssMutations.markRead(source.id, itemId)
            return
          }
        }
        return
      }

      setState((s) => {
        const store = s.contents[actualSourceId]
        if (!store) return s
        return {
          ...s,
          contents: {
            ...s.contents,
            [actualSourceId]: {
              ...store,
              items: store.items.map((i: RssItem) =>
                i.id === itemId ? { ...i, isRead: true } : i,
              ),
            },
          },
        }
      })
      await rssMutations.markRead(actualSourceId, itemId)
    },
    [state],
  )

  const markAllRead = useCallback(
    async (sourceId: string) => {
      // If called from __today__ or all view, mark all sources as read
      if (sourceId === '__today__' || !sourceId) {
        const config = state.config
        if (!config) return
        setState((s) => {
          const newContents = { ...s.contents }
          for (const source of config.sources) {
            const store = newContents[source.id]
            if (store) {
              newContents[source.id] = {
                ...store,
                items: store.items.map((i: RssItem) => ({
                  ...i,
                  isRead: true,
                })),
              }
            }
          }
          return { ...s, contents: newContents }
        })
        for (const source of config.sources) {
          await rssMutations.markAllRead(source.id)
        }
        return
      }

      setState((s) => {
        const store = s.contents[sourceId]
        if (!store) return s
        return {
          ...s,
          contents: {
            ...s.contents,
            [sourceId]: {
              ...store,
              items: store.items.map((i: RssItem) => ({ ...i, isRead: true })),
            },
          },
        }
      })
      await rssMutations.markAllRead(sourceId)
    },
    [state.config],
  )

  const toggleBookmark = useCallback(async (item: RssItem) => {
    await rss.toggleBookmark(item.id, {
      sourceId: item.feedTitle || item.link,
      sourceTitle: item.feedTitle || '',
      title: item.title,
      link: item.link,
    })
    const bookmarks = await rss.getBookmarks()
    setState((s) => ({
      ...s,
      bookmarks,
      contents: Object.fromEntries(
        Object.entries(s.contents).map(
          ([sid, store]: [string, RssContentStore]) => [
            sid,
            {
              ...store,
              items: store.items.map((i: RssItem) =>
                i.id === item.id
                  ? { ...i, isBookmarked: !!bookmarks[item.id] }
                  : i,
              ),
            },
          ],
        ),
      ),
    }))
  }, [])

  // ─── Config Mutations ──────────────────────────────────────────────

  const addGroup = useCallback(
    async (name: string) => {
      const existing = state.config || { groups: [], sources: [] }
      const newGroup = {
        id: crypto.randomUUID(),
        name,
        sortOrder: existing.groups.length,
      }
      existing.groups.push(newGroup)
      await rssMutations.saveConfig(existing)
      const fresh = await rss.getConfig()
      setState((s) => ({ ...s, config: fresh }))
    },
    [state.config],
  )

  const deleteGroup = useCallback(
    async (groupId: string) => {
      const config = state.config
      if (!config) return
      const removed = config.sources.filter(
        (s: RssSource) => s.groupId === groupId,
      )
      const updated = {
        groups: config.groups.filter((g) => g.id !== groupId),
        sources: config.sources.filter((s: RssSource) => s.groupId !== groupId),
      }
      await rssMutations.saveConfig(updated)
      for (const source of removed) {
        await rssMutations.deleteSourceContent(source.id)
      }
      const [fresh, contents] = await Promise.all([
        rss.getConfig(),
        rss.getAllContents(),
      ])
      setState((s) => ({
        ...s,
        config: fresh,
        contents,
        selectedSourceId: null,
        selectedItemId: null,
      }))
    },
    [state.config],
  )

  const addSource = useCallback(
    async (url: string, groupId: string) => {
      const config = state.config
      if (!config) return
      const source = {
        id: crypto.randomUUID(),
        url,
        groupId,
        fetchIntervalMs: 1_800_000,
      }
      config.sources.push(source)
      await rssMutations.saveConfig(config)
      await rss.fetchFeed(source.id)
      const [fresh, contents] = await Promise.all([
        rss.getConfig(),
        rss.getAllContents(),
      ])
      setState((s) => ({
        ...s,
        config: fresh,
        contents,
        selectedSourceId: source.id,
        selectedItemId: null,
      }))
    },
    [state.config],
  )

  const updateSource = useCallback(
    async (sourceId: string, updates: Partial<RssSource>) => {
      const config = state.config
      if (!config) return
      const idx = config.sources.findIndex((s: RssSource) => s.id === sourceId)
      if (idx === -1) return
      config.sources[idx] = { ...config.sources[idx], ...updates }
      await rssMutations.saveConfig(config)
      const fresh = await rss.getConfig()
      setState((s) => ({ ...s, config: fresh }))
    },
    [state.config],
  )

  const deleteSource = useCallback(
    async (sourceId: string) => {
      const config = state.config
      if (!config) return
      config.sources = config.sources.filter(
        (s: RssSource) => s.id !== sourceId,
      )
      await rssMutations.saveConfig(config)
      await rssMutations.deleteSourceContent(sourceId)
      const [fresh, contents] = await Promise.all([
        rss.getConfig(),
        rss.getAllContents(),
      ])
      setState((s) => ({
        ...s,
        config: fresh,
        contents,
        selectedSourceId:
          s.selectedSourceId === sourceId ? null : s.selectedSourceId,
        selectedItemId:
          s.selectedSourceId === sourceId ? null : s.selectedItemId,
      }))
    },
    [state.config],
  )

  return {
    ...state,
    loadAll,
    savePanelWidths,
    selectSource,
    selectToday,
    selectItem,
    getCurrentItems,
    getBookmarkedItems,
    getSelectedItem,
    fetchAll,
    fetchSource,
    markRead,
    markAllRead,
    toggleBookmark,
    addGroup,
    deleteGroup,
    addSource,
    updateSource,
    deleteSource,
  }
}
