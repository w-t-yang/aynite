import { randomUUID } from 'node:crypto'
import {
  ensureDir,
  exists,
  getRssBookmarksPath,
  getRssConfigPath,
  getRssContentPath,
  getRssDir,
  readJson,
  unlink,
  writeJson,
} from '../../lib/path'
import type {
  RssBookmarks,
  RssConfig,
  RssContentStore,
  RssItem,
  RssSource,
} from '../../lib/types/rss'

const MAX_ITEMS_PER_SOURCE = 500

async function _getContentsDir() {
  const dir = `${getRssDir()}/contents`
  await ensureDir(dir)
  return dir
}

// ─── Init ──────────────────────────────────────────────────────────────

export async function initRss() {
  const dir = getRssDir()
  await ensureDir(dir)
  await ensureDir(`${dir}/contents`)

  // Create default config if it doesn't exist
  const configPath = getRssConfigPath()
  if (!(await exists(configPath))) {
    const defaultConfig = getDefaultConfig()
    await writeJson(configPath, defaultConfig)
  }
}

function getDefaultConfig(): RssConfig {
  const techGroup = { id: randomUUID(), name: 'Technology', sortOrder: 0 }
  return {
    groups: [techGroup],
    sources: [
      {
        id: randomUUID(),
        url: 'https://hnrss.org/frontpage',
        title: 'Hacker News',
        groupId: techGroup.id,
        fetchIntervalMs: 1_800_000,
      },
      {
        id: randomUUID(),
        url: 'https://feeds.arstechnica.com/arstechnica/index',
        title: 'Ars Technica',
        groupId: techGroup.id,
        fetchIntervalMs: 1_800_000,
      },
      {
        id: randomUUID(),
        url: 'https://www.theverge.com/rss/index.xml',
        title: 'The Verge',
        groupId: techGroup.id,
        fetchIntervalMs: 1_800_000,
      },
      {
        id: randomUUID(),
        url: 'https://blog.rust-lang.org/feed.xml',
        title: 'Rust Blog',
        groupId: techGroup.id,
        fetchIntervalMs: 1_800_000,
      },
    ],
  }
}

// ─── Config ────────────────────────────────────────────────────────────

export async function getConfig(): Promise<RssConfig> {
  const configPath = getRssConfigPath()
  if (!(await exists(configPath))) return { groups: [], sources: [] }
  return await readJson<RssConfig>(configPath)
}

export async function saveConfig(config: RssConfig): Promise<void> {
  await writeJson(getRssConfigPath(), config)
}

export async function createGroup(
  config: RssConfig,
  name: string,
): Promise<RssConfig> {
  const group = {
    id: randomUUID(),
    name,
    sortOrder: config.groups.length,
  }
  config.groups.push(group)
  return config
}

export async function updateGroup(
  config: RssConfig,
  groupId: string,
  updates: Partial<{ name: string; sortOrder: number }>,
): Promise<RssConfig> {
  const idx = config.groups.findIndex((g) => g.id === groupId)
  if (idx === -1) throw new Error(`Group not found: ${groupId}`)
  config.groups[idx] = { ...config.groups[idx], ...updates }
  return config
}

export async function deleteGroup(
  config: RssConfig,
  groupId: string,
): Promise<RssConfig> {
  // Remove all sources in this group and their content
  const toRemove = config.sources.filter((s) => s.groupId === groupId)
  for (const source of toRemove) {
    const contentPath = getRssContentPath(source.id)
    if (await exists(contentPath)) {
      await unlink(contentPath).catch(() => {})
    }
  }
  config.sources = config.sources.filter((s) => s.groupId !== groupId)
  config.groups = config.groups.filter((g) => g.id !== groupId)
  return config
}

export async function addSource(
  config: RssConfig,
  url: string,
  groupId: string,
): Promise<RssConfig> {
  if (!url.trim()) throw new Error('URL is required')
  const source: RssSource = {
    id: randomUUID(),
    url: url.trim(),
    groupId,
    fetchIntervalMs: 1_800_000, // 30 min
  }
  config.sources.push(source)
  return config
}

export async function updateSource(
  config: RssConfig,
  sourceId: string,
  updates: Partial<
    Pick<RssSource, 'url' | 'groupId' | 'title' | 'fetchIntervalMs'>
  >,
): Promise<RssConfig> {
  const idx = config.sources.findIndex((s) => s.id === sourceId)
  if (idx === -1) throw new Error(`Source not found: ${sourceId}`)
  config.sources[idx] = { ...config.sources[idx], ...updates }
  return config
}

export async function deleteSource(
  config: RssConfig,
  sourceId: string,
): Promise<RssConfig> {
  config.sources = config.sources.filter((s) => s.id !== sourceId)
  const contentPath = getRssContentPath(sourceId)
  if (await exists(contentPath)) {
    await unlink(contentPath).catch(() => {})
  }
  return config
}

// ─── Feed Fetching ─────────────────────────────────────────────────────

function itemId(item: {
  guid?: string
  link?: string
  title?: string
  pubDate?: string
}): string {
  if (item.guid) return item.guid
  if (item.link) {
    // Simple hash of the link for a stable id
    let hash = 0
    for (let i = 0; i < item.link.length; i++) {
      const chr = item.link.charCodeAt(i)
      hash = (hash << 5) - hash + chr
      hash |= 0
    }
    return `h-${Math.abs(hash).toString(36)}`
  }
  return randomUUID()
}

export async function fetchFeedItem(url: string): Promise<{
  title?: string
  description?: string
  items: Array<{
    guid?: string
    title?: string
    link?: string
    content?: string
    contentSnippet?: string
    pubDate?: string
    isoDate?: string
    author?: string
    categories?: string[]
  }>
}> {
  // Dynamic import to avoid dependency at module load time
  const Parser = (await import('rss-parser')).default
  const parser = new Parser({
    timeout: 15000,
    headers: {
      'User-Agent': 'AyniteRSS/1.0',
    },
  })
  const feed = await parser.parseURL(url)
  return {
    title: feed.title,
    description: feed.description,
    items: feed.items || [],
  }
}

export async function fetchSource(
  config: RssConfig,
  sourceId: string,
): Promise<{ content: RssContentStore; error?: string }> {
  const source = config.sources.find((s) => s.id === sourceId)
  if (!source) throw new Error(`Source not found: ${sourceId}`)

  // Load existing content
  const existingPath = getRssContentPath(sourceId)
  const existing: RssContentStore = (await exists(existingPath))
    ? await readJson<RssContentStore>(existingPath)
    : { sourceId, items: [], lastFetchedAt: '' }

  try {
    const feed = await fetchFeedItem(source.url)

    // Build lookup of existing items by id
    const existingMap = new Map<string, RssItem>()
    for (const item of existing.items) {
      existingMap.set(item.id, item)
    }

    // Map feed items to RssItems, preserving read/bookmark state
    const now = new Date().toISOString()
    const newItems: RssItem[] = []
    for (const fi of feed.items) {
      const id = itemId(fi)
      const existingItem = existingMap.get(id)
      if (existingItem) {
        existingMap.delete(id)
        newItems.push(existingItem)
      } else {
        newItems.push({
          id,
          title: fi.title || '(no title)',
          link: fi.link || '',
          pubDate: fi.isoDate || fi.pubDate || now,
          content: fi.content || '',
          contentSnippet: fi.contentSnippet || '',
          author: fi.author,
          categories: fi.categories,
          isRead: false,
          isBookmarked: false,
          feedTitle: feed.title || source.title || '',
        })
      }
    }

    // Append remaining existing items (those not in the new feed)
    for (const item of existingMap.values()) {
      newItems.push(item)
    }

    // Sort by pubDate descending, newest first
    newItems.sort(
      (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime(),
    )

    // Cap at MAX_ITEMS_PER_SOURCE
    if (newItems.length > MAX_ITEMS_PER_SOURCE) {
      newItems.length = MAX_ITEMS_PER_SOURCE
    }

    const content: RssContentStore = {
      sourceId,
      items: newItems,
      lastFetchedAt: now,
    }

    await writeJson(getRssContentPath(sourceId), content)

    // Update source metadata
    if (feed.title) source.title = feed.title
    source.lastFetchedAt = now
    source.error = undefined
    await saveConfig(config)

    return { content }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    source.error = message
    await saveConfig(config)

    // Return existing content even on error
    return { content: existing, error: message }
  }
}

export async function fetchAll(config: RssConfig): Promise<{
  results: Array<{ sourceId: string; success: boolean; error?: string }>
}> {
  const results: Array<{ sourceId: string; success: boolean; error?: string }> =
    []
  for (const source of config.sources) {
    const { error } = await fetchSource(config, source.id)
    results.push({ sourceId: source.id, success: !error, error })
  }
  return { results }
}

// ─── Content Access ────────────────────────────────────────────────────

export async function getContent(
  sourceId: string,
): Promise<RssContentStore | null> {
  const path = getRssContentPath(sourceId)
  if (!(await exists(path))) return null
  return await readJson<RssContentStore>(path)
}

export async function getAllContents(
  config: RssConfig,
): Promise<Record<string, RssContentStore>> {
  const result: Record<string, RssContentStore> = {}
  for (const source of config.sources) {
    const content = await getContent(source.id)
    if (content) result[source.id] = content
  }
  return result
}

export async function deleteContent(sourceId: string): Promise<void> {
  const path = getRssContentPath(sourceId)
  if (await exists(path)) {
    await unlink(path)
  }
}

// ─── Read Status ───────────────────────────────────────────────────────

export async function markRead(
  sourceId: string,
  itemId: string,
): Promise<void> {
  const path = getRssContentPath(sourceId)
  if (!(await exists(path))) return
  const content = await readJson<RssContentStore>(path)
  const item = content.items.find((i) => i.id === itemId)
  if (item) {
    item.isRead = true
    await writeJson(path, content)
  }
}

export async function markAllRead(sourceId: string): Promise<void> {
  const path = getRssContentPath(sourceId)
  if (!(await exists(path))) return
  const content = await readJson<RssContentStore>(path)
  for (const item of content.items) {
    item.isRead = true
  }
  await writeJson(path, content)
}

// ─── Bookmarks ─────────────────────────────────────────────────────────

export async function getBookmarks(): Promise<RssBookmarks> {
  return await readJson<RssBookmarks>(getRssBookmarksPath(), {})
}

export async function toggleBookmark(
  itemId: string,
  data: { sourceId: string; sourceTitle: string; title: string; link: string },
): Promise<RssBookmarks> {
  const bookmarks = await getBookmarks()
  if (bookmarks[itemId]) {
    delete bookmarks[itemId]
  } else {
    bookmarks[itemId] = {
      itemId,
      sourceId: data.sourceId,
      sourceTitle: data.sourceTitle,
      title: data.title,
      link: data.link,
      addedAt: new Date().toISOString(),
    }
  }
  await writeJson(getRssBookmarksPath(), bookmarks)
  return bookmarks
}
