export type {
  RssBookmark,
  RssBookmarks,
  RssConfig,
  RssContentStore,
  RssGroup,
  RssItem,
  RssSource,
} from '../../../../src/lib/types/rss'

export type ViewMode = 'all' | 'bookmarks'

export interface ViewState {
  selectedGroupId: string | null
  selectedSourceId: string | null
  selectedItemId: string | null
  view: ViewMode
  searchQuery: string
}
