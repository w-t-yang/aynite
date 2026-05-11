export interface RssGroup {
  id: string
  name: string
  sortOrder: number
}

export interface RssSource {
  id: string
  url: string
  title?: string
  description?: string
  icon?: string
  groupId: string
  lastFetchedAt?: string
  fetchIntervalMs: number
  error?: string
}

export interface RssConfig {
  groups: RssGroup[]
  sources: RssSource[]
  panelWidths?: {
    sidebar?: number
    articleList?: number
  }
}

export interface RssItem {
  id: string
  title: string
  link: string
  pubDate: string
  content?: string
  contentSnippet?: string
  author?: string
  categories?: string[]
  isRead: boolean
  isBookmarked: boolean
  feedTitle?: string
}

export interface RssContentStore {
  sourceId: string
  items: RssItem[]
  lastFetchedAt: string
}

export interface RssBookmark {
  itemId: string
  sourceId: string
  sourceTitle: string
  title: string
  link: string
  addedAt: string
}

export type RssBookmarks = Record<string, RssBookmark>
