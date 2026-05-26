import { randomUUID } from 'node:crypto'
import { generateText } from 'ai'
import {
  ensureDir,
  exists,
  getAIConfigPath,
  getRssBookmarksPath,
  getRssConfigPath,
  getRssContentPath,
  getRssContentsDir,
  getRssDir,
  getRssSummariesDir,
  getRssSummaryPath,
  readdir,
  readJson,
  unlink,
  writeJson,
} from '../../lib/path'
import type { AIProvider } from '../../lib/types/ai'
import type {
  RssBookmarks,
  RssConfig,
  RssContentStore,
  RssItem,
  RssSource,
} from '../../lib/types/rss'
import { getAIModel } from '../ai/factory'

const MAX_ITEMS_PER_SOURCE = 500

function getDateStr(pubDate: string): string {
  try {
    return new Date(pubDate).toISOString().split('T')[0]
  } catch {
    return new Date().toISOString().split('T')[0]
  }
}

async function listDateDirs(): Promise<string[]> {
  const dir = getRssContentsDir()
  await ensureDir(dir)
  const entries = await readdir(dir)
  return entries
    .filter((e) => e.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(e.name))
    .map((e) => e.name)
    .sort()
}

async function deleteAllSourceFiles(sourceId: string): Promise<void> {
  const dates = await listDateDirs()
  for (const date of dates) {
    const path = getRssContentPath(date, sourceId)
    if (await exists(path)) {
      await unlink(path).catch(() => {})
    }
  }
}

// ─── Init ──────────────────────────────────────────────────────────────

export async function initRss() {
  const dir = getRssDir()
  await ensureDir(dir)
  await ensureDir(getRssContentsDir())

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
      {
        id: randomUUID(),
        url: 'http://labs.spotify.com/feed/',
        title: 'Spotify Engineering',
        groupId: techGroup.id,
        fetchIntervalMs: 1_800_000,
      },
      {
        id: randomUUID(),
        url: 'https://blog.pragmaticengineer.com/rss/',
        title: 'The Pragmatic Engineer',
        groupId: techGroup.id,
        fetchIntervalMs: 1_800_000,
      },
      {
        id: randomUUID(),
        url: 'https://openai.com/news/engineering/rss.xml',
        title: 'OpenAI Engineering News',
        groupId: techGroup.id,
        fetchIntervalMs: 1_800_000,
      },
      {
        id: randomUUID(),
        url: 'https://uxplanet.org/feed',
        title: 'UX Planet',
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
  // Remove all sources in this group and their content across all dates
  const toRemove = config.sources.filter((s) => s.groupId === groupId)
  for (const source of toRemove) {
    await deleteAllSourceFiles(source.id)
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
  await deleteAllSourceFiles(sourceId)
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

  // Load existing content aggregated across all dates
  const existing = await getContent(sourceId)
  const existingItems = existing?.items || []

  try {
    const feed = await fetchFeedItem(source.url)

    // Build lookup of existing items by id
    const existingMap = new Map<string, RssItem>()
    for (const item of existingItems) {
      existingMap.set(item.id, item)
    }

    // Map feed items to RssItems, preserving read/bookmark state
    const now = new Date().toISOString()
    const allItems: RssItem[] = []
    for (const fi of feed.items) {
      const id = itemId(fi)
      const existingItem = existingMap.get(id)
      if (existingItem) {
        existingMap.delete(id)
        allItems.push(existingItem)
      } else {
        allItems.push({
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
      allItems.push(item)
    }

    // Sort by pubDate descending, newest first
    allItems.sort(
      (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime(),
    )

    // Cap at MAX_ITEMS_PER_SOURCE
    if (allItems.length > MAX_ITEMS_PER_SOURCE) {
      allItems.length = MAX_ITEMS_PER_SOURCE
    }

    // Delete old per-date files and write new ones grouped by date
    await deleteAllSourceFiles(sourceId)

    const byDate = new Map<string, RssItem[]>()
    for (const item of allItems) {
      const d = getDateStr(item.pubDate)
      if (!byDate.has(d)) byDate.set(d, [])
      byDate.get(d)?.push(item)
    }

    for (const [date, items] of byDate) {
      await writeJson(getRssContentPath(date, sourceId), {
        sourceId,
        items,
        lastFetchedAt: now,
      })
    }

    // Update source metadata
    if (feed.title) source.title = feed.title
    source.lastFetchedAt = now
    source.error = undefined
    await saveConfig(config)

    return {
      content: {
        sourceId,
        items: allItems,
        lastFetchedAt: now,
      },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    source.error = message
    await saveConfig(config)

    // Return existing content even on error
    return {
      content: { sourceId, items: existingItems, lastFetchedAt: '' },
      error: message,
    }
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
  const dates = await listDateDirs()
  const allItems: RssItem[] = []
  let found = false

  for (const date of dates) {
    const path = getRssContentPath(date, sourceId)
    if (await exists(path)) {
      found = true
      const store = await readJson<RssContentStore>(path)
      allItems.push(...store.items)
    }
  }

  if (!found) return null

  allItems.sort(
    (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime(),
  )

  return { sourceId, items: allItems, lastFetchedAt: '' }
}

export async function getAllContents(
  config: RssConfig,
): Promise<Record<string, RssContentStore>> {
  // Initialize accumulators for all sources
  const sourceItems = new Map<string, RssItem[]>()
  for (const source of config.sources) {
    sourceItems.set(source.id, [])
  }

  // Single pass through all date directories
  const dates = await listDateDirs()
  for (const date of dates) {
    for (const source of config.sources) {
      const path = getRssContentPath(date, source.id)
      if (await exists(path)) {
        const store = await readJson<RssContentStore>(path)
        const items = sourceItems.get(source.id)
        if (items) items.push(...store.items)
      }
    }
  }

  const result: Record<string, RssContentStore> = {}
  for (const source of config.sources) {
    const items = sourceItems.get(source.id) || []
    if (items.length > 0) {
      items.sort(
        (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime(),
      )
      result[source.id] = {
        sourceId: source.id,
        items,
        lastFetchedAt: source.lastFetchedAt || '',
      }
    }
  }
  return result
}

export async function deleteContent(sourceId: string): Promise<void> {
  await deleteAllSourceFiles(sourceId)
}

// ─── Summarization ─────────────────────────────────────────────────────

/**
 * Fetch article URL content with realistic browser headers.
 * Some sites block minimal User-Agent headers, so we send a full set
 * of standard browser request headers.
 */
export async function fetchArticleText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'Sec-GPC': '1',
      DNT: '1',
    },
  })
  if (!response.ok)
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  const html = await response.text()
  return html
    .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, '')
    .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, '')
    .replace(/<nav\b[^>]*>([\s\S]*?)<\/nav>/gi, '')
    .replace(/<footer\b[^>]*>([\s\S]*?)<\/footer>/gi, '')
    .replace(/<header\b[^>]*>([\s\S]*?)<\/header>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 15000)
}

export async function summarizeArticle(
  itemId: string,
  url: string,
  existingContent?: string,
  existingSnippet?: string,
): Promise<string> {
  // 1. Check cache
  const summaryPath = getRssSummaryPath(itemId)
  await ensureDir(getRssSummariesDir())

  if (await exists(summaryPath)) {
    const cached = await readJson<{ summary: string }>(summaryPath)
    return cached.summary
  }

  // 2. Get article text — try URL fetch first, fall back to RSS content
  let articleText = ''
  try {
    articleText = await fetchArticleText(url)
  } catch {
    // If URL fetch fails, use existing RSS content or snippet
    if (existingContent) {
      articleText = existingContent
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 15000)
    } else if (existingSnippet) {
      articleText = existingSnippet.trim().slice(0, 15000)
    }
  }

  if (!articleText) throw new Error('No content available for summarization')

  // 3. Get active AI provider config
  const aiConfig = await readJson<{
    activeId: string
    providers: AIProvider[]
  }>(getAIConfigPath(), { activeId: '', providers: [] })
  const activeProvider = aiConfig.providers.find(
    (p: AIProvider) => p.id === aiConfig.activeId,
  )
  if (!activeProvider) throw new Error('No active AI provider configured')

  // 4. Generate summary via AI (reasoning disabled — unnecessary for summarization)
  const model = getAIModel(activeProvider)
  const { text: summary } = await generateText({
    model,
    messages: [
      {
        role: 'system',
        content:
          'You are a precise article summarizer. Read the article and provide a concise summary in 3-4 paragraphs. Focus on the key points, main arguments, and conclusions. Use clear, plain language. Do not include promotional content or opinions — just factual summary.',
      },
      {
        role: 'user',
        content: `Please summarize this article:\n\n${articleText}`,
      },
    ],
    providerOptions: {
      anthropic: { thinking: { type: 'disabled' } },
      deepseek: { thinking: { type: 'disabled' } },
      google: { thinkingConfig: { thinkingLevel: 'minimal' } },
      openai: { reasoning_effort: null },
    },
  })

  // 5. Cache and return
  await writeJson(summaryPath, {
    summary,
    url,
    generatedAt: new Date().toISOString(),
  })
  return summary
}

// ─── Read Status ───────────────────────────────────────────────────────

export async function markRead(
  sourceId: string,
  itemId: string,
): Promise<void> {
  const dates = await listDateDirs()
  for (const date of dates) {
    const path = getRssContentPath(date, sourceId)
    if (!(await exists(path))) continue
    const content = await readJson<RssContentStore>(path)
    const item = content.items.find((i) => i.id === itemId)
    if (item) {
      item.isRead = true
      await writeJson(path, content)
      return
    }
  }
}

export async function markAllRead(sourceId: string): Promise<void> {
  const dates = await listDateDirs()
  for (const date of dates) {
    const path = getRssContentPath(date, sourceId)
    if (!(await exists(path))) continue
    const content = await readJson<RssContentStore>(path)
    for (const item of content.items) {
      item.isRead = true
    }
    await writeJson(path, content)
  }
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
