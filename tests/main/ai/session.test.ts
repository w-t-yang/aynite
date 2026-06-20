import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Mocks ──────────────────────────────────────────────────────────────

const mockStat = vi.hoisted(() => vi.fn())
const mockReaddir = vi.hoisted(() => vi.fn())
const mockReadJson = vi.hoisted(() => vi.fn())
const mockWriteJson = vi.hoisted(() => vi.fn())
const mockRm = vi.hoisted(() => vi.fn())
const mockMkdir = vi.hoisted(() => vi.fn())

vi.mock('../../../src/lib/path', () => ({
  stat: (...args: unknown[]) => mockStat(...args),
  readdir: (...args: unknown[]) => mockReaddir(...args),
  readJson: (...args: unknown[]) => mockReadJson(...args),
  writeJson: (...args: unknown[]) => mockWriteJson(...args),
  getSessionDir: vi.fn(
    (id: string, workspace?: string) =>
      `/mock/workspaces/${workspace}/sessions/${id}`,
  ),
  getSessionMessagesPath: vi.fn(
    (id: string, workspace?: string) =>
      `/mock/workspaces/${workspace}/sessions/${id}/messages.json`,
  ),
  getSessionMetadataFilePath: vi.fn(
    (id: string, workspace?: string) =>
      `/mock/workspaces/${workspace}/sessions/${id}/metadata.json`,
  ),
  getWorkspaceSessionsDir: vi.fn(
    (name: string) => `/mock/workspaces/${name}/sessions`,
  ),
  getLogPath: vi.fn(() => '/mock/logs/ai-chat.log'),
  appendText: vi.fn(),
}))

vi.mock('node:fs/promises', () => ({
  rm: (...args: unknown[]) => Promise.resolve(mockRm(...args)),
  mkdir: (...args: unknown[]) => Promise.resolve(mockMkdir(...args)),
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

    expect(mockMkdir).toHaveBeenCalledWith(
      '/mock/workspaces/Dev/sessions/session-1',
      { recursive: true },
    )
    expect(mockWriteJson).toHaveBeenCalledWith(
      '/mock/workspaces/Dev/sessions/session-1/messages.json',
      messages,
    )
  })

  it('writes metadata file when metadata provided and does not exist', async () => {
    mockReadJson.mockRejectedValueOnce(new Error('ENOENT'))

    await saveSession(
      'Dev',
      'session-1',
      [{ role: 'user', content: 'hello' }] as any,
      { agentName: 'Aynite', modelName: 'gpt-4o' } as any,
    )

    expect(mockWriteJson).toHaveBeenCalledTimes(2)
    expect(mockWriteJson).toHaveBeenCalledWith(
      '/mock/workspaces/Dev/sessions/session-1/metadata.json',
      { agentName: 'Aynite', modelName: 'gpt-4o' },
    )
  })

  it('merges with existing metadata when present', async () => {
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

    expect(mockWriteJson).toHaveBeenCalledWith(
      '/mock/workspaces/Dev/sessions/session-1/metadata.json',
      { agentName: 'Old Agent', modelName: 'new-model' },
    )
  })

  it('saves empty messages array', async () => {
    await saveSession('Dev', 'empty-session', [] as any)
    expect(mockWriteJson).toHaveBeenCalledWith(
      '/mock/workspaces/Dev/sessions/empty-session/messages.json',
      [],
    )
  })
})

// ─── loadSession ─────────────────────────────────────────────────────────

describe('loadSession', () => {
  it('loads session messages', async () => {
    const sessionData = [{ role: 'user', content: 'hello' }]
    mockReadJson.mockResolvedValue(sessionData)

    const result = await loadSession('Dev', 'session-1')
    expect(result).toEqual(sessionData)
    expect(mockReadJson).toHaveBeenCalledWith(
      '/mock/workspaces/Dev/sessions/session-1/messages.json',
    )
  })

  it('returns null when session file not found', async () => {
    mockReadJson.mockRejectedValue(new Error('ENOENT'))

    const result = await loadSession('Dev', 'missing')
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

  it('lists sessions from directories', async () => {
    // readdir on sessions dir returns session folders
    mockReaddir.mockResolvedValue([
      dirent('session-1', true),
      dirent('session-2', true),
    ])

    // session-1: messages.json read, metadata.json read, stat on messages.json
    mockReadJson.mockResolvedValueOnce([
      { role: 'user', parts: [{ text: 'Hello world' }] },
    ])
    mockReadJson.mockRejectedValueOnce(new Error('ENOENT')) // no metadata
    mockStat.mockResolvedValueOnce({ mtime: new Date('2026-06-15T10:00:00Z') })
    // session-2
    mockReadJson.mockResolvedValueOnce([
      { role: 'user', parts: [{ text: 'Second chat' }] },
    ])
    mockReadJson.mockRejectedValueOnce(new Error('ENOENT'))
    mockStat.mockResolvedValueOnce({ mtime: new Date('2026-06-15T11:00:00Z') })

    const result = await listSessions('Dev')
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('session-2')
    expect(result[0].preview).toBe('Second chat')
    expect(result[1].id).toBe('session-1')
    expect(result[1].preview).toBe('Hello world')
  })

  it('uses metadata for title when available', async () => {
    mockReaddir.mockResolvedValue([dirent('session-1', true)])

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

  it('sorts by lastModified descending', async () => {
    mockReaddir.mockResolvedValue([dirent('a', true), dirent('b', true)])

    // Session 'a'
    mockReadJson.mockResolvedValueOnce([
      { role: 'user', parts: [{ text: 'First' }] },
    ])
    mockReadJson.mockRejectedValueOnce(new Error('ENOENT'))
    mockStat.mockResolvedValueOnce({ mtime: new Date('2026-06-14T08:00:00Z') })
    // Session 'b'
    mockReadJson.mockResolvedValueOnce([
      { role: 'user', parts: [{ text: 'Second' }] },
    ])
    mockReadJson.mockRejectedValueOnce(new Error('ENOENT'))
    mockStat.mockResolvedValueOnce({ mtime: new Date('2026-06-14T10:00:00Z') })

    const result = await listSessions('Dev')
    expect(result[0].preview).toBe('Second')
    expect(result[1].preview).toBe('First')
  })
})

// ─── deleteSession ───────────────────────────────────────────────────────

describe('deleteSession', () => {
  it('removes session directory recursively', async () => {
    await deleteSession('Dev', 'session-1')

    expect(mockRm).toHaveBeenCalledWith(
      '/mock/workspaces/Dev/sessions/session-1',
      { recursive: true, force: true },
    )
  })

  it('handles missing session directory gracefully', async () => {
    mockRm.mockRejectedValue(new Error('ENOENT'))
    // Should not throw — .catch(() => {}) in deleteSession
    await expect(deleteSession('Dev', 'ghost-session')).resolves.toBeUndefined()
  })
})
