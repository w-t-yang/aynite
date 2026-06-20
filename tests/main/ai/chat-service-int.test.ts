/**
 * Integration test for AI session lifecycle using a real temporary directory.
 *
 * Tests saveSession → loadSession → listSessions → deleteSession
 * through the actual chat.ts module with real filesystem I/O.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Mock path helpers to use temp dir ─────────────────────────────────

let tmpDir = ''

const mockGetWorkspaceSessionsDir = vi.hoisted(() =>
  vi.fn((name: string) => join(tmpDir, name, 'sessions')),
)
const mockGetSessionDir = vi.hoisted(
  () => (id: string, workspace?: string) =>
    join(tmpDir, workspace || 'testws', 'sessions', id),
)
const mockGetSessionMessagesPath = vi.hoisted(
  () => (id: string, workspace?: string) =>
    join(tmpDir, workspace || 'testws', 'sessions', id, 'messages.json'),
)
const mockGetSessionMetadataFilePath = vi.hoisted(
  () => (id: string, workspace?: string) =>
    join(tmpDir, workspace || 'testws', 'sessions', id, 'metadata.json'),
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
  getSessionDir: (...args: unknown[]) => mockGetSessionDir(...args),
  getSessionMessagesPath: (...args: unknown[]) =>
    mockGetSessionMessagesPath(...args),
  getSessionMetadataFilePath: (...args: unknown[]) =>
    mockGetSessionMetadataFilePath(...args),
  getLogPath: (...args: unknown[]) => mockGetLogPath(...args),
  appendText: (...args: unknown[]) => mockAppendText(...args),
}))

vi.mock('node:fs/promises', () => ({
  rm: vi.fn((p: string, opts: any) => {
    const fs = require('node:fs')
    try {
      fs.rmSync(p, opts)
    } catch {
      // ignore
    }
    return Promise.resolve()
  }),
  mkdir: vi.fn((p: string, opts: any) => {
    const fs = require('node:fs')
    fs.mkdirSync(p, opts)
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
  const fs = require('node:fs')
  fs.mkdirSync(join(tmpDir, 'testws', 'sessions'), { recursive: true })
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
    const loaded = await loadSession('testws', 'session-1')

    expect(loaded).toEqual(messages)
  })

  it('save → list shows session', async () => {
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

    const loaded = await loadSession('testws', 'session-to-delete')
    expect(loaded).toBeNull()
  })

  it('handles empty messages array', async () => {
    await saveSession('testws', 'empty-session', [] as any)
    const loaded = await loadSession('testws', 'empty-session')

    expect(loaded).toEqual([])
  })

  it('lists multiple sessions', async () => {
    const msg1 = [
      {
        role: 'user',
        content: 'session one',
        parts: [{ type: 'text', text: 'session one' }],
      },
    ]
    const msg2 = [
      {
        role: 'user',
        content: 'session two',
        parts: [{ type: 'text', text: 'session two' }],
      },
    ]

    await saveSession('testws', 'session-a', msg1 as any)
    await saveSession('testws', 'session-b', msg2 as any)

    const sessions = await listSessions('testws')
    expect(sessions.length).toBe(2)
    const ids = sessions.map((s: any) => s.id).sort()
    expect(ids).toEqual(['session-a', 'session-b'])
  })
})
