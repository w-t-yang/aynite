/**
 * Bridge module: RSS operations
 *
 * Typed getters and setters for RSS feed management.
 */

function getAynite() {
  if (!window.aynite) {
    throw new Error('Aynite bridge not available (not running in Electron?)')
  }
  return window.aynite
}

// ── Getters (return data) ────────────────────────────────────────────

export const rss = (() => ({
  getConfig: (): Promise<any> => getAynite().rssGetConfig(),

  fetchFeed: (sourceId: string): Promise<any> =>
    getAynite().rssFetchFeed(sourceId),

  fetchAll: (): Promise<any> => getAynite().rssFetchAll(),

  getContent: (sourceId: string): Promise<any> =>
    getAynite().rssGetContent(sourceId),

  getAllContents: (): Promise<Record<string, any>> =>
    getAynite().rssGetAllContents(),

  getBookmarks: (): Promise<Record<string, any>> =>
    getAynite().rssGetBookmarks(),

  toggleBookmark: (itemId: string, data: any): Promise<Record<string, any>> =>
    getAynite().rssToggleBookmark(itemId, data),

  summarizeArticle: (
    itemId: string,
    url: string,
    content?: string,
    contentSnippet?: string,
  ): Promise<string> =>
    getAynite().rssSummarizeArticle(itemId, url, content, contentSnippet),
}))()

// ── Setters (return void — state changes come through events) ────────

export const rssMutations = (() => ({
  saveConfig: (config: any): Promise<void> =>
    getAynite()
      .rssSaveConfig(config)
      .then(() => {}),

  markRead: (sourceId: string, itemId: string): Promise<void> =>
    getAynite()
      .rssMarkRead(sourceId, itemId)
      .then(() => {}),

  markAllRead: (sourceId: string): Promise<void> =>
    getAynite()
      .rssMarkAllRead(sourceId)
      .then(() => {}),

  deleteSourceContent: (sourceId: string): Promise<void> =>
    getAynite()
      .rssDeleteSourceContent(sourceId)
      .then(() => {}),
}))()
