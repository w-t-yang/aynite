import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Mocks ──────────────────────────────────────────────────────────────

const mockExists = vi.hoisted(() => vi.fn())
const mockReaddir = vi.hoisted(() => vi.fn())
const mockReadJson = vi.hoisted(() => vi.fn())
const mockWriteJson = vi.hoisted(() => vi.fn())
const mockEnsureDir = vi.hoisted(() => vi.fn())
const mockUnlink = vi.hoisted(() => vi.fn())

vi.mock('../../../src/lib/path', () => ({
  exists: (...args: unknown[]) => mockExists(...args),
  readdir: (...args: unknown[]) => mockReaddir(...args),
  readJson: (...args: unknown[]) => mockReadJson(...args),
  writeJson: (...args: unknown[]) => mockWriteJson(...args),
  ensureDir: (...args: unknown[]) => mockEnsureDir(...args),
  unlink: (...args: unknown[]) => mockUnlink(...args),
  getRssConfigPath: vi.fn(() => '/mock/.aynite/rss/config.json'),
  getRssBookmarksPath: vi.fn(() => '/mock/.aynite/rss/bookmarks.json'),
  getRssContentPath: vi.fn(
    (date: string, sourceId: string) =>
      `/mock/.aynite/rss/contents/${date}/${sourceId}.json`,
  ),
  getRssContentsDir: vi.fn(() => '/mock/.aynite/rss/contents'),
  getRssSummaryPath: vi.fn(
    (itemId: string) => `/mock/.aynite/rss/summaries/${itemId}.json`,
  ),
  getRssSummariesDir: vi.fn(() => '/mock/.aynite/rss/summaries'),
  getRssDir: vi.fn(() => '/mock/.aynite/rss'),
  getAIConfigPath: vi.fn(() => '/mock/.aynite/config/ai.json'),
}))

vi.mock('../../../src/main/ai', () => ({
  getAIModel: vi.fn(() => ({})),
  DISABLED_REASONING_OPTIONS: {},
}))

// Mock rss-parser — needs to be a constructable class for `new Parser()`
vi.mock('rss-parser', () => ({
  default: class MockRssParser {
    parseURL = vi.fn(() =>
      Promise.resolve({
        title: 'Test Feed',
        description: 'A test feed',
        items: [
          {
            guid: 'post-1',
            title: 'Test Post',
            link: 'https://example.com/post-1',
            content: '<p>Hello world</p>',
            pubDate: '2026-06-15T10:00:00Z',
            isoDate: '2026-06-15T10:00:00Z',
          },
        ],
      }),
    )
  },
}))

// Mock ai for generateText in summarizeArticle
vi.mock('ai', () => ({
  generateText: vi.fn(() =>
    Promise.resolve({ text: 'This is a summary of the article.' }),
  ),
}))

import {
  addSource,
  createGroup,
  deleteGroup,
  deleteSource,
  fetchAll,
  fetchSource,
  getAllContents,
  getBookmarks,
  getConfig,
  getContent,
  initRss,
  markAllRead,
  markRead,
  saveConfig,
  toggleBookmark,
  updateGroup,
  updateSource,
} from '../../../src/main/rss/logic'

beforeEach(() => {
  // Don't use clearAllMocks — the rss-parser mock uses internal vi.fn()
  // that gets reset. Instead, manually reset our hoisted mocks.
  mockExists.mockReset()
  mockReaddir.mockReset()
  mockReadJson.mockReset()
  mockWriteJson.mockReset()
  mockEnsureDir.mockReset()
  mockUnlink.mockReset()
  // Default mocks
  mockReaddir.mockResolvedValue([])
  mockUnlink.mockResolvedValue(undefined)
})

function dirent(name: string, isDir: boolean) {
  return { name, isDirectory: () => isDir }
}

// Helper to create a basic config
function makeConfig() {
  return {
    groups: [{ id: 'g-1', name: 'Tech', sortOrder: 0 }],
    sources: [
      {
        id: 's-1',
        url: 'https://example.com/rss',
        title: 'Example Blog',
        groupId: 'g-1',
        fetchIntervalMs: 1800000,
      },
    ],
  }
}

// ─── Config Management ─────────────────────────────────────────────────

describe('config management', () => {
  describe('getConfig', () => {
    it('returns config when it exists', async () => {
      mockExists.mockResolvedValue(true)
      mockReadJson.mockResolvedValue(makeConfig())

      const config = await getConfig()
      expect(config.groups).toHaveLength(1)
      expect(config.sources).toHaveLength(1)
    })

    it('returns empty config when file does not exist', async () => {
      mockExists.mockResolvedValue(false)
      const config = await getConfig()
      expect(config).toEqual({ groups: [], sources: [] })
    })
  })

  describe('saveConfig', () => {
    it('writes config to disk', async () => {
      const config = makeConfig()
      await saveConfig(config)
      expect(mockWriteJson).toHaveBeenCalledWith(
        '/mock/.aynite/rss/config.json',
        config,
      )
    })
  })
})

// ─── Group Management ───────────────────────────────────────────────────

describe('group management', () => {
  describe('createGroup', () => {
    it('adds a new group with next sortOrder', async () => {
      const config = {
        groups: [{ id: 'g-1', name: 'Tech', sortOrder: 0 }],
        sources: [],
      }
      const result = await createGroup(config, 'Design')
      expect(result.groups).toHaveLength(2)
      expect(result.groups[1].name).toBe('Design')
      expect(result.groups[1].sortOrder).toBe(1)
    })
  })

  describe('updateGroup', () => {
    it('updates group name', async () => {
      const config = makeConfig()
      const result = await updateGroup(config, 'g-1', { name: 'Technology' })
      expect(result.groups[0].name).toBe('Technology')
    })

    it('throws for unknown group', async () => {
      const config = makeConfig()
      await expect(
        updateGroup(config, 'bad-id', { name: 'X' }),
      ).rejects.toThrow('Group not found')
    })
  })

  describe('deleteGroup', () => {
    it('removes group and its sources', async () => {
      mockExists.mockResolvedValue(false) // no content files to delete
      const config = makeConfig()

      const result = await deleteGroup(config, 'g-1')
      expect(result.groups).toHaveLength(0)
      expect(result.sources).toHaveLength(0)
    })
  })
})

// ─── Source Management ──────────────────────────────────────────────────

describe('source management', () => {
  describe('addSource', () => {
    it('adds a new source to the config', async () => {
      const config = makeConfig()
      const result = await addSource(config, 'https://newfeed.com/rss', 'g-1')
      expect(result.sources).toHaveLength(2)
      expect(result.sources[1].url).toBe('https://newfeed.com/rss')
      expect(result.sources[1].fetchIntervalMs).toBe(1800000)
    })

    it('throws for empty URL', async () => {
      const config = makeConfig()
      await expect(addSource(config, '', 'g-1')).rejects.toThrow(
        'URL is required',
      )
    })

    it('trims whitespace from URL', async () => {
      const config = makeConfig()
      const result = await addSource(config, '  https://feed.com/rss  ', 'g-1')
      expect(result.sources[1].url).toBe('https://feed.com/rss')
    })
  })

  describe('updateSource', () => {
    it('updates source fields', async () => {
      const config = makeConfig()
      const result = await updateSource(config, 's-1', {
        title: 'Updated Blog',
      })
      expect(result.sources[0].title).toBe('Updated Blog')
    })

    it('throws for unknown source', async () => {
      const config = makeConfig()
      await expect(
        updateSource(config, 'bad-id', { title: 'X' }),
      ).rejects.toThrow('Source not found')
    })
  })

  describe('deleteSource', () => {
    it('removes source and its content files', async () => {
      mockExists.mockResolvedValue(false)
      const config = makeConfig()

      const result = await deleteSource(config, 's-1')
      expect(result.sources).toHaveLength(0)
    })
  })
})

// ─── Fetch Source ───────────────────────────────────────────────────────

describe('fetchSource', () => {
  it('fetches new items and merges with existing', async () => {
    const config = makeConfig()
    mockReadJson.mockResolvedValue(null)
    mockExists.mockResolvedValue(false)

    const result = await fetchSource(config, 's-1')

    // Even without existing content, fetchSource should have items
    // from the rss-parser mock
    expect(result.error).toBeUndefined()
    // The result content is populated from the feed fetch
    expect(result.content).toBeDefined()
  })

  it('preserves read/bookmark state on refetch', async () => {
    const config = makeConfig()
    const existingItems = [
      {
        id: 'post-1',
        title: 'Existing Post',
        link: 'https://example.com/post-1',
        pubDate: '2026-06-15T10:00:00Z',
        content: '',
        contentSnippet: '',
        isRead: true,
        isBookmarked: true,
        feedTitle: 'Test Feed',
      },
    ]

    // getContent reads dates, finds content file
    mockReaddir.mockResolvedValue([
      { name: '2026-06-15', isDirectory: () => true },
    ])
    mockExists.mockResolvedValue(true)
    mockReadJson.mockResolvedValue({ sourceId: 's-1', items: existingItems })

    const result = await fetchSource(config, 's-1')
    const post1 = result.content.items.find((i) => i.id === 'post-1')
    expect(post1).toBeDefined()
    expect(post1?.isRead).toBe(true)
    expect(post1?.isBookmarked).toBe(true)
  })

  it('returns error for unknown source', async () => {
    const config = makeConfig()
    await expect(fetchSource(config, 'nonexistent')).rejects.toThrow(
      'Source not found',
    )
  })
})

// ─── Content Access ─────────────────────────────────────────────────────

describe('content access', () => {
  describe('getContent', () => {
    it('returns aggregated content across dates', async () => {
      mockReaddir.mockResolvedValue([
        dirent('2026-06-14', true),
        dirent('2026-06-15', true),
      ])
      mockExists.mockResolvedValue(true)
      mockReadJson
        .mockResolvedValueOnce({ sourceId: 's-1', items: [{ id: 'a' }] })
        .mockResolvedValueOnce({ sourceId: 's-1', items: [{ id: 'b' }] })

      const result = await getContent('s-1')
      expect(result).not.toBeNull()
      expect(result?.items).toHaveLength(2)
    })

    it('returns null when no content found', async () => {
      mockReaddir.mockResolvedValue([dirent('2026-06-14', true)])
      mockExists.mockResolvedValue(false)

      const result = await getContent('s-1')
      expect(result).toBeNull()
    })
  })

  describe('getAllContents', () => {
    it('returns all contents for all sources', async () => {
      const config = makeConfig()
      mockReaddir.mockResolvedValue([dirent('2026-06-15', true)])
      mockExists.mockResolvedValue(true)
      mockReadJson.mockResolvedValue({
        sourceId: 's-1',
        items: [{ id: 'post-1', pubDate: '2026-06-15T10:00:00Z' }],
      })

      const result = await getAllContents(config)
      expect(result['s-1']).toBeDefined()
      expect(result['s-1'].items).toHaveLength(1)
    })
  })
})

// ─── Read Status ────────────────────────────────────────────────────────

describe('read status', () => {
  describe('markRead', () => {
    it('marks item as read across dates', async () => {
      mockReaddir.mockResolvedValue([dirent('2026-06-15', true)])
      mockExists.mockResolvedValue(true)
      mockReadJson.mockResolvedValue({
        sourceId: 's-1',
        items: [{ id: 'post-1', isRead: false }],
      })

      await markRead('s-1', 'post-1')

      expect(mockWriteJson).toHaveBeenCalled()
      const writtenContent = mockWriteJson.mock.calls[0][1]
      expect(writtenContent.items[0].isRead).toBe(true)
    })
  })

  describe('markAllRead', () => {
    it('marks all items as read for a source', async () => {
      mockReaddir.mockResolvedValue([dirent('2026-06-15', true)])
      mockExists.mockResolvedValue(true)
      mockReadJson.mockResolvedValue({
        sourceId: 's-1',
        items: [
          { id: 'a', isRead: false },
          { id: 'b', isRead: false },
        ],
      })

      await markAllRead('s-1')

      expect(mockWriteJson).toHaveBeenCalled()
      const writtenContent = mockWriteJson.mock.calls[0][1]
      expect(writtenContent.items.every((i: any) => i.isRead)).toBe(true)
    })
  })
})

// ─── Bookmarks ──────────────────────────────────────────────────────────

describe('bookmarks', () => {
  describe('getBookmarks', () => {
    it('returns bookmarks from file', async () => {
      mockReadJson.mockResolvedValue({
        'item-1': { itemId: 'item-1', title: 'Bookmarked Post' },
      })

      const result = await getBookmarks()
      expect(result['item-1'].title).toBe('Bookmarked Post')
    })

    it('returns empty object when no bookmarks file', async () => {
      mockReadJson.mockResolvedValue({})
      const result = await getBookmarks()
      expect(result).toEqual({})
    })
  })

  describe('toggleBookmark', () => {
    it('adds a bookmark', async () => {
      mockReadJson.mockResolvedValue({})
      const result = await toggleBookmark('item-1', {
        sourceId: 's-1',
        sourceTitle: 'Example Blog',
        title: 'Test Post',
        link: 'https://example.com/post',
      })
      expect(result['item-1']).toBeDefined()
      expect(result['item-1'].title).toBe('Test Post')
    })

    it('removes a bookmark', async () => {
      mockReadJson.mockResolvedValue({
        'item-1': { itemId: 'item-1', title: 'Test Post' },
      })
      const result = await toggleBookmark('item-1', {
        sourceId: 's-1',
        sourceTitle: 'Example Blog',
        title: 'Test Post',
        link: 'https://example.com/post',
      })
      expect(result['item-1']).toBeUndefined()
    })
  })
})

// ─── initRss ────────────────────────────────────────────────────────────

describe('initRss', () => {
  it('creates directories without default config when config exists', async () => {
    mockEnsureDir.mockResolvedValue(undefined)
    mockExists.mockResolvedValue(true) // config exists
    mockReaddir.mockResolvedValue([])

    await initRss()
    expect(mockEnsureDir).toHaveBeenCalled()
    expect(mockWriteJson).not.toHaveBeenCalled()
  })

  it('creates default config when config missing', async () => {
    mockEnsureDir.mockResolvedValue(undefined)
    mockExists.mockResolvedValue(false) // config missing
    mockWriteJson.mockResolvedValue(undefined)

    await initRss()
    expect(mockWriteJson).toHaveBeenCalledWith(
      '/mock/.aynite/rss/config.json',
      expect.objectContaining({
        groups: expect.arrayContaining([
          expect.objectContaining({ name: 'Technology' }),
        ]),
      }),
    )
  })
})

// ─── fetchAll ───────────────────────────────────────────────────────────

describe('fetchAll', () => {
  it('fetches all sources and returns results', async () => {
    const config = makeConfig()
    // For fetchSource: getContent returns null, no existing files
    mockReadJson.mockResolvedValue(null)
    mockExists.mockResolvedValue(false)
    mockReaddir.mockResolvedValue([])

    const result = await fetchAll(config)
    expect(result.results).toHaveLength(1)
    expect(result.results[0].sourceId).toBe('s-1')
  })
})

// ─── deleteContent ──────────────────────────────────────────────────────

describe('deleteContent (via deleteSource which calls deleteAllSourceFiles)', () => {
  it('deletes content files across dates', async () => {
    mockReaddir.mockResolvedValue([
      dirent('2026-06-14', true),
      dirent('2026-06-15', true),
    ])
    mockExists.mockResolvedValue(true)

    const config = makeConfig()
    await deleteSource(config, 's-1')

    // deleteAllSourceFiles should unlink both dates
    expect(mockUnlink).toHaveBeenCalledTimes(2)
  })
})
