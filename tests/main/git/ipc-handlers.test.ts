import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Mocks ──────────────────────────────────────────────────────────────

const mockExecAsync = vi.hoisted(() => vi.fn())

// Mock node:child_process for exec (used by the handlers)
vi.mock('node:child_process', () => {
  const mockSpawnFn = vi.fn(() => ({
    stderr: { on: vi.fn() },
    stdin: { end: vi.fn(), write: vi.fn() },
    on: vi.fn((event: string, cb: (...args: any[]) => void) => {
      if (event === 'close') setTimeout(() => cb(0), 0)
    }),
  }))

  return {
    exec: vi.fn(),
    spawn: (...args: unknown[]) => mockSpawnFn(...args),
  }
})

// Mock node:util so promisify returns our mockExecAsync
// The source does: const execAsync = promisify(exec)
// promisify(exec) is called with the mocked exec (vi.fn())
// We make promisify return mockExecAsync regardless of argument
vi.mock('node:util', () => ({
  promisify: () => mockExecAsync,
}))

const mockExists = vi.hoisted(() => vi.fn())
const mockGetAbsolutePath = vi.hoisted(() => vi.fn((p: string) => p))
const mockGetRelativePath = vi.hoisted(() =>
  vi.fn((from: string, to: string) => {
    if (to.startsWith(from)) return to.slice(from.length + 1)
    return to
  }),
)
const mockJoinPaths = vi.hoisted(() =>
  vi.fn((...parts: string[]) => parts.join('/')),
)
const mockToUnixPath = vi.hoisted(() =>
  vi.fn((p: string) => p.replace(/\\/g, '/')),
)

vi.mock('../../../src/lib/path', () => ({
  exists: (...args: unknown[]) => mockExists(...args),
  getAbsolutePath: (...args: unknown[]) => mockGetAbsolutePath(...args),
  getRelativePath: (...args: unknown[]) => mockGetRelativePath(...args),
  joinPaths: (...args: unknown[]) => mockJoinPaths(...args),
  toUnixPath: (...args: unknown[]) => mockToUnixPath(...args),
  readdir: vi.fn(),
  readJson: vi.fn(),
  readText: vi.fn(),
  writeJson: vi.fn(),
}))

const mockTrackEvent = vi.hoisted(() => vi.fn())
vi.mock('../../../src/main/telemetry/index', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}))

vi.mock('../../../src/main/workspace', () => ({
  getWorkspaceFolders: vi.fn(() => Promise.resolve([])),
}))

// Mock the internal modules so the GitService doesn't try to do real work
vi.mock('../../../src/main/git/root-finder', () => ({
  createRootFinder: () => ({
    findGitRoot: vi.fn((path: string) => {
      if (path.startsWith('/repo')) return '/repo'
      return null
    }),
    clearCache: vi.fn(),
  }),
}))

vi.mock('../../../src/main/git/status-manager', () => ({
  createStatusManager: () => ({
    getStatus: vi.fn(() => ({ '/repo/file.ts': ' M' })),
    refreshStatus: vi.fn(() => Promise.resolve()),
    handleFsChange: vi.fn(),
    clearCache: vi.fn(),
  }),
}))

vi.mock('../../../src/main/git/git-watcher', () => ({
  createGitWatcher: () => ({
    refreshWatchers: vi.fn(),
  }),
}))

vi.mock('../../../src/main/git/commit-gen', () => ({
  generateCommitMessage: vi.fn(() => Promise.resolve('feat: test')),
}))

vi.mock('../../../src/main/git/porcelain', () => ({
  buildHunkPatch: vi.fn(() => 'mock-patch-content'),
  parseNumstat: vi.fn(() => ({})),
}))

// Capture ipcMain.handle calls during module import
const capturedHandlers: Record<string, (...args: any[]) => any> = {}

const mockIpcHandle = vi.hoisted(() =>
  vi.fn((channel: string, handler: (...args: any[]) => any) => {
    capturedHandlers[channel] = handler
  }),
)

vi.mock('electron', () => ({
  ipcMain: {
    handle: (...args: unknown[]) => mockIpcHandle(...args),
  },
}))

// Import AFTER mocks, and then trigger setup to register handlers
import { setupGitIpc } from '../../../src/main/git/index'

// Call setupGitIpc to register handlers, which calls ipcMain.handle for
// each channel, all captured by mockIpcHandle
setupGitIpc()

import { GitChannels } from '../../../src/lib/constants/ipc-channels'

beforeEach(() => {
  vi.clearAllMocks()
  // Restore execAsync mock after clearAllMocks resets it
  mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' })
})

// ─── STATUS ─────────────────────────────────────────────────────────────

describe('STATUS handler', () => {
  it('returns null for path outside git repo', async () => {
    const result = await capturedHandlers[GitChannels.STATUS](
      null,
      '/outside/file.ts',
    )
    expect(result).toBeNull()
  })

  it('returns cached status for tracked path', async () => {
    const result = await capturedHandlers[GitChannels.STATUS](
      null,
      '/repo/file.ts',
    )
    expect(result).toEqual({ '/repo/file.ts': ' M' })
  })
})

// ─── HEAD_CONTENT ───────────────────────────────────────────────────────

describe('HEAD_CONTENT handler', () => {
  it('returns null for path outside git repo', async () => {
    const result = await capturedHandlers[GitChannels.HEAD_CONTENT](
      null,
      '/outside/file.ts',
    )
    expect(result).toBeNull()
  })

  it('returns git show output for tracked file', async () => {
    mockExecAsync.mockResolvedValue({ stdout: 'file content from git' })

    const result = await capturedHandlers[GitChannels.HEAD_CONTENT](
      null,
      '/repo/file.ts',
    )

    expect(result).toBe('file content from git')
  })

  it('returns null when git show fails', async () => {
    mockExecAsync.mockRejectedValue(new Error('not a valid object name'))

    const result = await capturedHandlers[GitChannels.HEAD_CONTENT](
      null,
      '/repo/new-file.ts',
    )

    expect(result).toBeNull()
  })
})

// ─── INDEX_CONTENT ──────────────────────────────────────────────────────

describe('INDEX_CONTENT handler', () => {
  it('returns null for path outside git repo', async () => {
    const result = await capturedHandlers[GitChannels.INDEX_CONTENT](
      null,
      '/outside/file.ts',
    )
    expect(result).toBeNull()
  })

  it('returns index content from git show :path', async () => {
    mockExecAsync.mockResolvedValue({ stdout: 'staged content' })

    const result = await capturedHandlers[GitChannels.INDEX_CONTENT](
      null,
      '/repo/file.ts',
    )
    expect(result).toBe('staged content')
  })

  it('falls back to HEAD when index content not available', async () => {
    mockExecAsync
      .mockRejectedValueOnce(new Error('path not in index'))
      .mockResolvedValueOnce({ stdout: 'HEAD content' })

    const result = await capturedHandlers[GitChannels.INDEX_CONTENT](
      null,
      '/repo/file.ts',
    )
    expect(result).toBe('HEAD content')
  })
})

// ─── STAGE_HUNK ─────────────────────────────────────────────────────────

describe('STAGE_HUNK handler', () => {
  it('returns error for path outside git repo', async () => {
    const result = await capturedHandlers[GitChannels.STAGE_HUNK](null, {
      filePath: '/outside/file.ts',
      oldStart: 1,
      oldLines: ['line1'],
      newStart: 1,
      newLines: ['line1'],
    })
    expect(result).toMatchObject({ error: 'Not in a git repository' })
  })
})

// ─── DISCARD_HUNK ───────────────────────────────────────────────────────

describe('DISCARD_HUNK handler', () => {
  it('returns error for path outside git repo', async () => {
    const result = await capturedHandlers[GitChannels.DISCARD_HUNK](null, {
      filePath: '/outside/file.ts',
      oldStart: 1,
      oldLines: ['line1'],
      newStart: 1,
      newLines: ['line1'],
    })
    expect(result).toMatchObject({ error: 'Not in a git repository' })
  })
})

// ─── COMMIT_EXECUTE ─────────────────────────────────────────────────────

describe('COMMIT_EXECUTE handler', () => {
  it('returns error for empty message', async () => {
    const result = await capturedHandlers[GitChannels.COMMIT_EXECUTE](
      null,
      '/repo',
      '',
    )
    expect(result).toMatchObject({ error: 'Commit message cannot be empty' })
  })

  it('returns error for whitespace-only message', async () => {
    const result = await capturedHandlers[GitChannels.COMMIT_EXECUTE](
      null,
      '/repo',
      '   ',
    )
    expect(result).toMatchObject({ error: 'Commit message cannot be empty' })
  })
})
