/**
 * Integration test for AI session lifecycle using a real temporary directory.
 *
 * Tests saveSession → loadSession → listSessions → deleteSession
 * through the actual chat.ts module with real filesystem I/O.
 */
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Mock path helpers to use temp dir ─────────────────────────────────

let tmpDir = ''

const mockGetWorkspaceSessionsDir = vi.hoisted(() =>
  vi.fn((name: string) => join(tmpDir, name, 'sessions')),
)
const mockGetSessionPath = vi.hoisted(
  () => (id: string, date?: string, workspace?: string) =>
    join(
      tmpDir,
      workspace || 'testws',
      'sessions',
      date || '2026-06-15',
      `${id}.json`,
    ),
)
const mockGetSessionMetadataPath = vi.hoisted(
  () => (id: string, date?: string, workspace?: string) =>
    join(
      tmpDir,
      workspace || 'testws',
      'sessions',
      date || '2026-06-15',
      `${id}-metadata.json`,
    ),
)
const mockGetSessionsDateDir = vi.hoisted(
  () => (date: string, workspace?: string) =>
    join(tmpDir, workspace || 'testws', 'sessions', date),
)
const mockGetLogPath = vi.hoisted(() =>
  vi.fn(() => join(tmpDir, 'ai-chat.log')),
)
const mockAppendText = vi.hoisted(() => vi.fn())

vi.mock('../../../src/lib/path', () => ({
  stat: vi.fn((p: string) => {
    const fs = require('node:fs')
    try {
      const s = fs.statSync(p)
      return Promise.resolve(s)
    } catch {
      return Promise.reject(new Error('ENOENT'))
    }
  }),
  readdir: vi.fn((p: string) => {
    const fs = require('node:fs')
    try {
      const entries = fs.readdirSync(p, { withFileTypes: true })
      return Promise.resolve(entries)
    } catch {
      return Promise.reject(new Error('ENOENT'))
    }
  }),
  readJson: vi.fn(async (p: string) => {
    const fs = require('node:fs')
    const content = fs.readFileSync(p, 'utf-8')
    return JSON.parse(content)
  }),
  writeJson: vi.fn(async (p: string, data: any) => {
    const fs = require('node:fs')
    const dir = join(p, '..')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(p, JSON.stringify(data, null, 2))
  }),
  getWorkspaceSessionsDir: (...args: unknown[]) =>
    mockGetWorkspaceSessionsDir(...args),
  getSessionPath: (...args: unknown[]) => mockGetSessionPath(...args),
  getSessionMetadataPath: (...args: unknown[]) =>
    mockGetSessionMetadataPath(...args),
  getSessionsDateDir: (...args: unknown[]) => mockGetSessionsDateDir(...args),
  getLogPath: (...args: unknown[]) => mockGetLogPath(...args),
  appendText: (...args: unknown[]) => mockAppendText(...args),
}))

// Mock the real fs/promises used by deleteSession
vi.mock('node:fs/promises', () => ({
  unlink: vi.fn((p: string) => {
    const fs = require('node:fs')
    try {
      fs.unlinkSync(p)
    } catch {
      // ignore
    }
    return Promise.resolve()
  }),
  mkdir: vi.fn((p: string) => {
    const fs = require('node:fs')
    fs.mkdirSync(p, { recursive: true })
    return Promise.resolve()
  }),
}))

import {
  deleteSession,
  listSessions,
  loadSession,
  saveSession,
} from '../../../src/main/ai/chat'

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'aynite-test-'))
  // Create the sessions directory structure
  mkdirSync(join(tmpDir, 'testws', 'sessions', '2026-06-15'), {
    recursive: true,
  })
})

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true })
})

describe('chat-service integration', () => {
  it('save → load cycle preserves messages', async () => {
    const messages = [
      {
        role: 'user',
        content: 'hello',
        parts: [{ type: 'text', text: 'hello' }],
      },
    ]

    await saveSession('testws', 'session-1', messages as any)
    const loaded = await loadSession('testws', 'session-1', '2026-06-15')

    expect(loaded).toEqual(messages)
  })

  it('save → list shows session in correct date group', async () => {
    const messages = [
      {
        role: 'user',
        content: 'hello',
        parts: [{ type: 'text', text: 'hello' }],
      },
    ]

    await saveSession('testws', 'session-list-test', messages as any)
    const sessions = await listSessions('testws')

    expect(sessions.length).toBeGreaterThanOrEqual(1)
    const found = sessions.find((s: any) => s.id === 'session-list-test')
    expect(found).toBeDefined()
    expect(found.date).toBe('2026-06-15')
    expect(found.messageCount).toBe(1)
  })

  it('save → delete → load returns null', async () => {
    const messages = [
      {
        role: 'user',
        content: 'delete me',
        parts: [{ type: 'text', text: 'delete me' }],
      },
    ]

    await saveSession('testws', 'session-to-delete', messages as any)
    await deleteSession('testws', 'session-to-delete')

    const loaded = await loadSession(
      'testws',
      'session-to-delete',
      '2026-06-15',
    )
    expect(loaded).toBeNull()
  })

  it('handles empty messages array', async () => {
    await saveSession('testws', 'empty-session', [] as any)
    const loaded = await loadSession('testws', 'empty-session', '2026-06-15')

    expect(loaded).toEqual([])
  })

  it('lists multiple sessions across different dates', async () => {
    // Create sessions in different date dirs
    mkdirSync(join(tmpDir, 'testws', 'sessions', '2026-06-14'), {
      recursive: true,
    })

    const msg1 = [
      {
        role: 'user',
        content: 'day 1',
        parts: [{ type: 'text', text: 'day 1' }],
      },
    ]
    const msg2 = [
      {
        role: 'user',
        content: 'day 2',
        parts: [{ type: 'text', text: 'day 2' }],
      },
    ]

    await saveSession('testws', 'session-day1', msg1 as any)
    // Force different date by writing directly
    const fs = require('node:fs')
    fs.writeFileSync(
      join(tmpDir, 'testws', 'sessions', '2026-06-14', 'session-day1.json'),
      JSON.stringify(msg1),
    )
    fs.writeFileSync(
      join(tmpDir, 'testws', 'sessions', '2026-06-15', 'session-day2.json'),
      JSON.stringify(msg2),
    )

    const sessions = await listSessions('testws')
    // Should have 2 unique sessions (saveSession creates one, we wrote 2 more)
    expect(sessions.length).toBeGreaterThanOrEqual(2)
  })
})
