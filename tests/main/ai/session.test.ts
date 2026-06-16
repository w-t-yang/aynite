import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Mocks ──────────────────────────────────────────────────────────────

const mockStat = vi.hoisted(() => vi.fn())
const mockReaddir = vi.hoisted(() => vi.fn())
const mockReadJson = vi.hoisted(() => vi.fn())
const mockWriteJson = vi.hoisted(() => vi.fn())
const mockUnlink = vi.hoisted(() => vi.fn())

// (No hoisted path mocks needed — they use vi.fn() inside vi.mock)

// The path module mock uses hoisted functions; the actual functions used
// by chat.ts are: stat, readdir, readJson, writeJson, getSessionPath,
// getSessionMetadataPath, getWorkspaceSessionsDir, getSessionsDateDir
// The getSessionPath, getSessionMetadataPath, getWorkspaceSessionsDir,
// and getSessionsDateDir are pure path builders (no I/O), so they are
// replaced with deterministic path-returning functions.
vi.mock('../../../src/lib/path', () => ({
  stat: (...args: unknown[]) => mockStat(...args),
  readdir: (...args: unknown[]) => mockReaddir(...args),
  readJson: (...args: unknown[]) => mockReadJson(...args),
  writeJson: (...args: unknown[]) => mockWriteJson(...args),
  getSessionPath: vi.fn(
    (id: string, date?: string, workspace?: string) =>
      `/mock/workspaces/${workspace}/sessions/${date || '2026-06-15'}/${id}.json`,
  ),
  getSessionMetadataPath: vi.fn(
    (id: string, date?: string, workspace?: string) =>
      `/mock/workspaces/${workspace}/sessions/${date || '2026-06-15'}/${id}-metadata.json`,
  ),
  getWorkspaceSessionsDir: vi.fn(
    (name: string) => `/mock/workspaces/${name}/sessions`,
  ),
  getSessionsDateDir: vi.fn(
    (date: string, workspace?: string) =>
      `/mock/workspaces/${workspace}/sessions/${date}`,
  ),
  getLogPath: vi.fn(() => '/mock/logs/ai-chat.log'),
  appendText: vi.fn(),
}))

vi.mock('node:fs/promises', () => ({
  unlink: (...args: unknown[]) => Promise.resolve(mockUnlink(...args)),
  mkdir: vi.fn(() => Promise.resolve()),
}))

// Must import AFTER mocks
import {
  deleteSession,
  listSessions,
  loadSession,
  saveSession,
} from '../../../src/main/ai/chat'

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── Helper ──────────────────────────────────────────────────────────────

function dirent(name: string, isDir: boolean) {
  return { name, isDirectory: () => isDir, isFile: () => !isDir }
}

// ─── saveSession ─────────────────────────────────────────────────────────

describe('saveSession', () => {
  it('writes session messages JSON', async () => {
    const messages = [{ role: 'user', content: 'hello' }]
    await saveSession('Dev', 'session-1', messages as any)

    expect(mockWriteJson).toHaveBeenCalledWith(
      '/mock/workspaces/Dev/sessions/2026-06-15/session-1.json',
      messages,
    )
  })

  it('writes metadata file when metadata provided and does not exist', async () => {
    // The new saveSession uses readJson(...).catch(() => null) instead of stat
    mockReadJson.mockRejectedValueOnce(new Error('ENOENT'))

    await saveSession(
      'Dev',
      'session-1',
      [{ role: 'user', content: 'hello' }] as any,
      { agentName: 'Aynite', modelName: 'gpt-4o' } as any,
    )

    expect(mockWriteJson).toHaveBeenCalledTimes(2)
    expect(mockWriteJson).toHaveBeenCalledWith(
      expect.stringContaining('session-1-metadata.json'),
      { agentName: 'Aynite', modelName: 'gpt-4o' },
    )
  })

  it('merges with existing metadata when present', async () => {
    // Simulate existing metadata on disk
    mockReadJson.mockResolvedValueOnce({
      agentName: 'Old Agent',
      modelName: 'old-model',
    })

    await saveSession(
      'Dev',
      'session-1',
      [{ role: 'user', content: 'hello' }] as any,
      { modelName: 'new-model' } as any,
    )

    // Should merge old + new, with new properties winning
    expect(mockWriteJson).toHaveBeenCalledWith(
      expect.stringContaining('session-1-metadata.json'),
      { agentName: 'Old Agent', modelName: 'new-model' },
    )
  })

  it('saves empty messages array', async () => {
    await saveSession('Dev', 'empty-session', [] as any)
    expect(mockWriteJson).toHaveBeenCalledWith(
      expect.stringContaining('empty-session.json'),
      [],
    )
  })
})

// ─── loadSession ─────────────────────────────────────────────────────────

describe('loadSession', () => {
  it('loads session by id and date', async () => {
    const sessionData = [{ role: 'user', content: 'hello' }]
    mockReadJson.mockResolvedValue(sessionData)

    const result = await loadSession('Dev', 'session-1', '2026-06-15')
    expect(result).toEqual(sessionData)
  })

  it('returns null when session file not found with date', async () => {
    mockReadJson.mockRejectedValue(new Error('ENOENT'))

    const result = await loadSession('Dev', 'missing', '2026-06-15')
    expect(result).toBeNull()
  })

  it('searches all dates when no date provided', async () => {
    mockReaddir.mockResolvedValue([
      dirent('2026-06-14', true),
      dirent('2026-06-15', true),
    ])
    // First date dir: no match → returns null
    // Second date dir: found messages
    mockReadJson
      .mockRejectedValueOnce(new Error('ENOENT'))
      .mockResolvedValueOnce([{ role: 'user', content: 'found' }])

    const result = await loadSession('Dev', 'session-1')
    expect(result).toEqual([{ role: 'user', content: 'found' }])
    expect(mockReaddir).toHaveBeenCalledWith('/mock/workspaces/Dev/sessions')
  })

  it('returns null when session not found in any date', async () => {
    mockReaddir.mockResolvedValue([
      dirent('2026-06-14', true),
      dirent('2026-06-15', true),
    ])
    mockReadJson.mockRejectedValue(new Error('ENOENT'))

    const result = await loadSession('Dev', 'nowhere')
    expect(result).toBeNull()
  })

  it('returns null when sessions dir does not exist', async () => {
    mockReaddir.mockRejectedValue(new Error('ENOENT'))

    const result = await loadSession('Dev', 'session-1')
    expect(result).toBeNull()
  })
})

// ─── listSessions ────────────────────────────────────────────────────────

describe('listSessions', () => {
  it('returns empty array when sessions dir is empty', async () => {
    mockReaddir.mockResolvedValue([])
    const result = await listSessions('Dev')
    expect(result).toEqual([])
  })

  it('returns empty array when sessions dir does not exist', async () => {
    mockReaddir.mockRejectedValue(new Error('ENOENT'))
    const result = await listSessions('Dev')
    expect(result).toEqual([])
  })

  it('lists sessions grouped by date with metadata', async () => {
    // First readdir: one date directory
    mockReaddir.mockResolvedValueOnce([dirent('2026-06-15', true)])
    // Second readdir: two session files
    mockReaddir.mockResolvedValueOnce([
      dirent('session-1.json', false),
      dirent('session-2.json', false),
    ])

    // session-1: content, metadata, stat
    mockReadJson.mockResolvedValueOnce([
      { role: 'user', parts: [{ text: 'Hello world' }] },
    ])
    mockReadJson.mockRejectedValueOnce(new Error('ENOENT'))
    mockStat.mockResolvedValueOnce({ mtime: new Date('2026-06-15T10:00:00Z') })
    // session-2: content, metadata, stat
    mockReadJson.mockResolvedValueOnce([
      { role: 'user', parts: [{ text: 'Second chat' }] },
    ])
    mockReadJson.mockRejectedValueOnce(new Error('ENOENT'))
    mockStat.mockResolvedValueOnce({ mtime: new Date('2026-06-15T10:00:00Z') })

    const result = await listSessions('Dev')
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('session-1')
    expect(result[0].preview).toBe('Hello world')
    expect(result[0].messageCount).toBe(1)
  })

  it('uses metadata for title when available', async () => {
    mockReaddir.mockResolvedValueOnce([dirent('2026-06-15', true)])
    mockReaddir.mockResolvedValueOnce([dirent('session-1.json', false)])

    // session-1: content, metadata (found), stat
    mockReadJson.mockResolvedValueOnce([
      { role: 'user', parts: [{ text: 'Hi' }] },
    ])
    mockReadJson.mockResolvedValueOnce({
      agentName: 'Void Coder',
      modelName: 'claude-3',
    })
    mockStat.mockResolvedValueOnce({ mtime: new Date('2026-06-15T10:00:00Z') })

    const result = await listSessions('Dev')
    expect(result[0].title).toBe('Void Coder - claude-3')
  })

  it('deduplicates sessions by id keeping most recent', async () => {
    // Single readdir returns both date directories
    mockReaddir.mockResolvedValueOnce([
      dirent('2026-06-14', true),
      dirent('2026-06-15', true),
    ])
    // Then for each date, readdir lists session files
    mockReaddir.mockResolvedValueOnce([dirent('session-1.json', false)])
    mockReaddir.mockResolvedValueOnce([dirent('session-1.json', false)])

    // Session in 2026-06-14: content, metadata, stat
    mockReadJson.mockResolvedValueOnce([
      { role: 'user', parts: [{ text: 'Old' }] },
    ])
    mockReadJson.mockRejectedValueOnce(new Error('ENOENT'))
    mockStat.mockResolvedValueOnce({ mtime: new Date('2026-06-14T10:00:00Z') })
    // Session in 2026-06-15: content, metadata, stat
    mockReadJson.mockResolvedValueOnce([
      { role: 'user', parts: [{ text: 'New' }] },
    ])
    mockReadJson.mockRejectedValueOnce(new Error('ENOENT'))
    mockStat.mockResolvedValueOnce({ mtime: new Date('2026-06-15T10:00:00Z') })

    const result = await listSessions('Dev')
    expect(result).toHaveLength(1)
    expect(result[0].preview).toBe('New')
    expect(result[0].date).toBe('2026-06-15')
  })

  it('sorts by lastModified descending', async () => {
    // Single readdir returns one date dir
    mockReaddir.mockResolvedValueOnce([dirent('2026-06-14', true)])
    // Then readdir on date dir returns two session files
    mockReaddir.mockResolvedValueOnce([
      dirent('a.json', false),
      dirent('b.json', false),
    ])

    // Session 'a': content, metadata, stat
    mockReadJson.mockResolvedValueOnce([
      { role: 'user', parts: [{ text: 'First' }] },
    ])
    mockReadJson.mockRejectedValueOnce(new Error('ENOENT'))
    mockStat.mockResolvedValueOnce({ mtime: new Date('2026-06-14T08:00:00Z') })
    // Session 'b': content, metadata, stat
    mockReadJson.mockResolvedValueOnce([
      { role: 'user', parts: [{ text: 'Second' }] },
    ])
    mockReadJson.mockRejectedValueOnce(new Error('ENOENT'))
    mockStat.mockResolvedValueOnce({ mtime: new Date('2026-06-14T10:00:00Z') })

    const result = await listSessions('Dev')
    expect(result[0].preview).toBe('Second') // lastModified 10:00
    expect(result[1].preview).toBe('First') // lastModified 08:00
  })
})

// ─── deleteSession ───────────────────────────────────────────────────────

describe('deleteSession', () => {
  it('removes session and metadata files across all dates', async () => {
    // Single readdir returns both date directories
    mockReaddir.mockResolvedValueOnce([
      dirent('2026-06-14', true),
      dirent('2026-06-15', true),
    ])
    // stat checks: session file exists in both dates, metadata exists in both
    // Order: 2026-06-14 session, 2026-06-14 metadata, 2026-06-15 session, 2026-06-15 metadata
    mockStat
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)

    await deleteSession('Dev', 'session-1')

    // Should have unlinked in both date dirs
    expect(mockUnlink).toHaveBeenCalledTimes(4) // 2 sessions + 2 metadata
    expect(mockUnlink).toHaveBeenCalledWith(
      '/mock/workspaces/Dev/sessions/2026-06-14/session-1.json',
    )
    expect(mockUnlink).toHaveBeenCalledWith(
      '/mock/workspaces/Dev/sessions/2026-06-14/session-1-metadata.json',
    )
    expect(mockUnlink).toHaveBeenCalledWith(
      '/mock/workspaces/Dev/sessions/2026-06-15/session-1.json',
    )
    expect(mockUnlink).toHaveBeenCalledWith(
      '/mock/workspaces/Dev/sessions/2026-06-15/session-1-metadata.json',
    )
  })

  it('handles missing session directory gracefully', async () => {
    mockReaddir.mockRejectedValue(new Error('ENOENT'))

    // Should not throw
    await expect(deleteSession('Dev', 'ghost-session')).resolves.toBeUndefined()
    expect(mockUnlink).not.toHaveBeenCalled()
  })

  it('handles missing metadata file gracefully', async () => {
    mockReaddir.mockResolvedValue([dirent('2026-06-15', true)])
    // session file exists but metadata file doesn't
    mockStat
      .mockResolvedValueOnce(true) // session file exists
      .mockRejectedValueOnce(new Error('ENOENT')) // metadata doesn't exist

    await deleteSession('Dev', 'session-1')
    expect(mockUnlink).toHaveBeenCalledTimes(1)
    expect(mockUnlink).toHaveBeenCalledWith(
      '/mock/workspaces/Dev/sessions/2026-06-15/session-1.json',
    )
  })
})
