import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockExecAsync = vi.hoisted(() => vi.fn())
const mockExists = vi.hoisted(() => vi.fn())
const mockBroadcastAppEvent = vi.hoisted(() => vi.fn())
const mockParsePorcelain = vi.hoisted(() => vi.fn())

// Mock exec at the node module level BEFORE promisify wraps it
vi.mock('node:child_process', () => ({
  exec: (...args: unknown[]) => mockExecAsync(...args),
}))

vi.mock('../../../src/lib/path', () => ({
  exists: (...args: unknown[]) => mockExists(...args),
  joinPaths: vi.fn((...parts: string[]) => parts.join('/')),
}))

vi.mock('../../../src/main/git/porcelain', () => ({
  parsePorcelain: (...args: unknown[]) => mockParsePorcelain(...args),
}))

vi.mock('../../../src/main/window', () => ({
  broadcastAppEvent: (...args: unknown[]) => mockBroadcastAppEvent(...args),
}))

vi.mock('../../../src/main/ipc-utils', () => ({
  broadcastAppEvent: (...args: unknown[]) => mockBroadcastAppEvent(...args),
}))

const mockRootFinder = {
  findGitRoot: vi.fn(async (path: string) => {
    if (path.startsWith('/repo')) return '/repo'
    return null
  }),
  clearCache: vi.fn(),
}

describe('createStatusManager', () => {
  let statusManager: ReturnType<
    typeof import('../../../src/main/git/status-manager')['createStatusManager']
  >

  beforeEach(async () => {
    vi.clearAllMocks()
    const { createStatusManager } = await import(
      '../../../src/main/git/status-manager'
    )
    statusManager = createStatusManager(mockRootFinder)
  })

  describe('refreshStatus', () => {
    it('runs git status and caches result', async () => {
      // Make the promisified exec resolve immediately
      mockExecAsync.mockImplementation(
        (
          _cmd: string,
          _opts: any,
          cb: (...args: unknown[]) => undefined | undefined,
        ) => {
          if (cb) cb(null, { stdout: ' M src/file.ts\n', stderr: '' })
          return { stdout: '', stderr: '' }
        },
      )
      mockExists.mockResolvedValue(true)
      mockParsePorcelain.mockReturnValue({
        '/repo/src/file.ts': 'modified',
      })

      await statusManager.refreshStatus('/repo', true)

      expect(mockParsePorcelain).toHaveBeenCalled()
    })

    it('skips if .git does not exist', async () => {
      mockExists.mockResolvedValue(false)

      await statusManager.refreshStatus('/repo', true)

      expect(mockExecAsync).not.toHaveBeenCalled()
    })

    it('broadcasts event when status changes', async () => {
      mockExecAsync.mockImplementation(
        (
          _cmd: string,
          _opts: any,
          cb: (...args: unknown[]) => undefined | undefined,
        ) => {
          if (cb) cb(null, { stdout: ' M src/file.ts\n', stderr: '' })
          return { stdout: '', stderr: '' }
        },
      )
      mockExists.mockResolvedValue(true)
      mockParsePorcelain.mockReturnValue({
        '/repo/src/file.ts': 'modified',
      })

      await statusManager.refreshStatus('/repo', true)

      expect(mockBroadcastAppEvent).toHaveBeenCalledWith('git-status-changed', {
        root: '/repo',
        status: { '/repo/src/file.ts': 'modified' },
      })
    })

    it('debounces rapid successive calls', async () => {
      vi.useFakeTimers()
      mockExecAsync.mockImplementation(
        (
          _cmd: string,
          _opts: any,
          cb: (...args: unknown[]) => undefined | undefined,
        ) => {
          if (cb) cb(null, { stdout: ' M f.ts\n', stderr: '' })
          return { stdout: '', stderr: '' }
        },
      )
      mockExists.mockResolvedValue(true)
      mockParsePorcelain.mockReturnValue({ '/repo/f.ts': 'modified' })

      statusManager.refreshStatus('/repo') // no immediate flag
      statusManager.refreshStatus('/repo') // second call resets debounce

      await vi.advanceTimersByTimeAsync(300)

      // Should only have called exec once due to debounce
      expect(mockExecAsync).toHaveBeenCalledTimes(1)
      vi.useRealTimers()
    })

    it('does not broadcast if status unchanged', async () => {
      mockExecAsync.mockImplementation(
        (
          _cmd: string,
          _opts: any,
          cb: (...args: unknown[]) => undefined | undefined,
        ) => {
          if (cb) cb(null, { stdout: ' M f.ts\n', stderr: '' })
          return { stdout: '', stderr: '' }
        },
      )
      mockExists.mockResolvedValue(true)
      mockParsePorcelain.mockReturnValue({ '/repo/f.ts': 'modified' })

      await statusManager.refreshStatus('/repo', true)
      expect(mockBroadcastAppEvent).toHaveBeenCalledTimes(1)

      // Second call with same data
      await statusManager.refreshStatus('/repo', true)
      expect(mockBroadcastAppEvent).toHaveBeenCalledTimes(1)
    })
  })

  describe('getStatus', () => {
    it('returns undefined for root with no cached status', () => {
      expect(statusManager.getStatus('/repo')).toBeUndefined()
    })

    it('returns cached status after refresh', async () => {
      mockExecAsync.mockImplementation(
        (
          _cmd: string,
          _opts: any,
          cb: (...args: unknown[]) => undefined | undefined,
        ) => {
          if (cb) cb(null, { stdout: ' M f.ts\n', stderr: '' })
          return { stdout: '', stderr: '' }
        },
      )
      mockExists.mockResolvedValue(true)
      mockParsePorcelain.mockReturnValue({ '/repo/f.ts': 'modified' })

      await statusManager.refreshStatus('/repo', true)
      const result = statusManager.getStatus('/repo')
      expect(result).toEqual({ '/repo/f.ts': 'modified' })
    })
  })

  describe('handleFsChange', () => {
    it('triggers refresh when path is inside a git repo', async () => {
      mockExecAsync.mockImplementation(
        (
          _cmd: string,
          _opts: any,
          cb: (...args: unknown[]) => undefined | undefined,
        ) => {
          if (cb) cb(null, { stdout: '', stderr: '' })
          return { stdout: '', stderr: '' }
        },
      )
      mockExists.mockResolvedValue(true)
      mockParsePorcelain.mockReturnValue({})

      await statusManager.handleFsChange('/repo/file.ts')

      expect(mockRootFinder.findGitRoot).toHaveBeenCalledWith('/repo/file.ts')
    })

    it('skips refresh when path is outside a git repo', async () => {
      await statusManager.handleFsChange('/tmp/file.ts')

      expect(mockRootFinder.findGitRoot).toHaveBeenCalledWith('/tmp/file.ts')
      expect(mockExecAsync).not.toHaveBeenCalled()
    })
  })

  describe('clearCache', () => {
    it('clears cached statuses', async () => {
      mockExecAsync.mockImplementation(
        (
          _cmd: string,
          _opts: any,
          cb: (...args: unknown[]) => undefined | undefined,
        ) => {
          if (cb) cb(null, { stdout: ' M f.ts\n', stderr: '' })
          return { stdout: '', stderr: '' }
        },
      )
      mockExists.mockResolvedValue(true)
      mockParsePorcelain.mockReturnValue({ '/repo/f.ts': 'modified' })

      await statusManager.refreshStatus('/repo', true)
      expect(statusManager.getStatus('/repo')).toBeDefined()

      statusManager.clearCache()
      expect(statusManager.getStatus('/repo')).toBeUndefined()
    })
  })
})
