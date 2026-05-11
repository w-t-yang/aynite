import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  RssBookmarks,
  RssConfig,
  RssContentStore,
  RssItem,
  RssSource,
} from '../types'

const aw = () => window.aynite

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
    selectedSourceId: null,
    selectedItemId: null,
    panelWidths: { sidebar: 220, articleList: 340 },
  })

  const autoFetchDone = useRef(false)

  const loadAll = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const [config, contents, bookmarks] = await Promise.all([
        aw().rssGetConfig(),
        aw().rssGetAllContents(),
        aw().rssGetBookmarks(),
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
          if (!store) return true // never fetched
          const age = Date.now() - new Date(store.lastFetchedAt).getTime()
          return age > STALE_MS
        })
        if (stale.length > 0) {
          setState((s) => ({ ...s, fetching: true }))
          for (const src of stale) {
            try {
              await aw().rssFetchFeed(src.id)
            } catch {
              /* individual fetch failure is non-fatal */
            }
          }
          const [freshConfig, freshContents] = await Promise.all([
            aw().rssGetConfig(),
            aw().rssGetAllContents(),
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
        await aw().rssSaveConfig(config)
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

  const selectItem = useCallback((itemId: string | null) => {
    setState((s) => ({ ...s, selectedItemId: itemId }))
  }, [])

  const getCurrentItems = useCallback((): RssItem[] => {
    const { config, contents, selectedSourceId } = state
    if (!config) return []

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
    return store ? store.items : []
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
    const items = getCurrentItems()
    return items.find((i: RssItem) => i.id === state.selectedItemId) || null
  }, [state, getCurrentItems])

  const fetchAll = useCallback(async () => {
    setState((s) => ({ ...s, fetching: true }))
    try {
      await aw().rssFetchAll()
      await loadAll()
    } catch (e: any) {
      setState((s) => ({ ...s, error: e?.message, fetching: false }))
    }
  }, [loadAll])

  const fetchSource = useCallback(async (sourceId: string) => {
    setState((s) => ({ ...s, fetching: true }))
    try {
      await aw().rssFetchFeed(sourceId)
      const [config, contents] = await Promise.all([
        aw().rssGetConfig(),
        aw().rssGetAllContents(),
      ])
      setState((s) => ({ ...s, config, contents, fetching: false }))
    } catch (e: any) {
      setState((s) => ({ ...s, error: e?.message, fetching: false }))
    }
  }, [])

  const markRead = useCallback(
    async (itemId: string) => {
      const sourceId = state.selectedSourceId
      if (!sourceId) return
      setState((s) => {
        const store = s.contents[sourceId]
        if (!store) return s
        return {
          ...s,
          contents: {
            ...s.contents,
            [sourceId]: {
              ...store,
              items: store.items.map((i: RssItem) =>
                i.id === itemId ? { ...i, isRead: true } : i,
              ),
            },
          },
        }
      })
      await aw().rssMarkRead(sourceId, itemId)
    },
    [state.selectedSourceId],
  )

  const markAllRead = useCallback(async (sourceId: string) => {
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
    await aw().rssMarkAllRead(sourceId)
  }, [])

  const toggleBookmark = useCallback(async (item: RssItem) => {
    await aw().rssToggleBookmark(item.id, {
      sourceId: item.feedTitle || item.link,
      sourceTitle: item.feedTitle || '',
      title: item.title,
      link: item.link,
    })
    const bookmarks = await aw().rssGetBookmarks()
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
      await aw().rssSaveConfig(existing)
      const fresh = await aw().rssGetConfig()
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
      await aw().rssSaveConfig(updated)
      for (const source of removed) {
        await aw().rssDeleteSourceContent(source.id)
      }
      const [fresh, contents] = await Promise.all([
        aw().rssGetConfig(),
        aw().rssGetAllContents(),
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
      await aw().rssSaveConfig(config)
      await aw().rssFetchFeed(source.id)
      const [fresh, contents] = await Promise.all([
        aw().rssGetConfig(),
        aw().rssGetAllContents(),
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
      await aw().rssSaveConfig(config)
      const fresh = await aw().rssGetConfig()
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
      await aw().rssSaveConfig(config)
      await aw().rssDeleteSourceContent(sourceId)
      const [fresh, contents] = await Promise.all([
        aw().rssGetConfig(),
        aw().rssGetAllContents(),
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
