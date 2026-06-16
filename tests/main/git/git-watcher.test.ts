import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockFsWatch = vi.hoisted(() => vi.fn())
const mockExists = vi.hoisted(() => vi.fn())
const mockOnRefresh = vi.hoisted(() => vi.fn())

vi.mock('node:fs', () => ({
  watch: (...args: unknown[]) => mockFsWatch(...args),
  FSWatcher: vi.fn(),
}))

vi.mock('../../../src/lib/path', () => ({
  exists: (...args: unknown[]) => mockExists(...args),
  joinPaths: vi.fn((...parts: string[]) => parts.join('/')),
}))

describe('createGitWatcher', () => {
  let gitWatcher: ReturnType<
    typeof import('../../../src/main/git/git-watcher')['createGitWatcher']
  >

  beforeEach(async () => {
    vi.clearAllMocks()
    const { createGitWatcher } = await import(
      '../../../src/main/git/git-watcher'
    )
    gitWatcher = createGitWatcher(mockOnRefresh)
  })

  describe('setupWatcher', () => {
    it('sets up watchers on .git/HEAD and .git/index', async () => {
      mockExists.mockResolvedValue(true)
      const mockClose = vi.fn()
      mockFsWatch.mockReturnValue({ close: mockClose })

      await gitWatcher.setupWatcher('/repo')

      expect(mockFsWatch).toHaveBeenCalledWith(
        '/repo/.git/HEAD',
        expect.any(Function),
      )
      expect(mockFsWatch).toHaveBeenCalledWith(
        '/repo/.git/index',
        expect.any(Function),
      )
    })

    it('skips setup if .git directory does not exist', async () => {
      mockExists.mockResolvedValue(false)

      await gitWatcher.setupWatcher('/outside')

      expect(mockFsWatch).not.toHaveBeenCalled()
    })

    it('calls refresh callback when HEAD file changes', async () => {
      mockExists.mockResolvedValue(true)
      let headCallback: (...args: unknown[]) => void = () => {}
      mockFsWatch.mockImplementation(
        (path: string, cb: (...args: unknown[]) => void) => {
          if (path.endsWith('/HEAD')) headCallback = cb
          return { close: vi.fn() }
        },
      )

      await gitWatcher.setupWatcher('/repo')
      headCallback()

      expect(mockOnRefresh).toHaveBeenCalledWith('/repo')
    })

    it('tears down existing watcher before setting up new one', async () => {
      mockExists.mockResolvedValue(true)
      const closeMock = vi.fn()
      mockFsWatch.mockReturnValue({ close: closeMock })

      await gitWatcher.setupWatcher('/repo')
      await gitWatcher.setupWatcher('/repo')

      // First watcher should be closed
      expect(closeMock).toHaveBeenCalled()
    })
  })

  describe('teardownWatcher', () => {
    it('closes and removes watcher for a root', async () => {
      mockExists.mockResolvedValue(true)
      const closeMock = vi.fn()
      mockFsWatch.mockReturnValue({ close: closeMock })

      await gitWatcher.setupWatcher('/repo')
      gitWatcher.teardownWatcher('/repo')

      expect(closeMock).toHaveBeenCalled()
    })

    it('does nothing for unregistered root', () => {
      // Should not throw
      gitWatcher.teardownWatcher('/unknown')
    })
  })

  describe('refreshWatchers', () => {
    it('tears down watchers for roots not in folders list', async () => {
      mockExists.mockResolvedValue(true)
      const closeMock = vi.fn()
      mockFsWatch.mockReturnValue({ close: closeMock })

      // Set up two watchers
      await gitWatcher.setupWatcher('/repo-a')
      await gitWatcher.setupWatcher('/repo-b')

      // Refresh with only repo-a in the list
      gitWatcher.refreshWatchers(['/repo-a'])

      // repo-b's watcher should be closed
      expect(closeMock).toHaveBeenCalled()
    })

    it('keeps watchers for roots in the folders list', async () => {
      mockExists.mockResolvedValue(true)
      const closeMock = vi.fn()
      mockFsWatch.mockReturnValue({ close: closeMock })

      await gitWatcher.setupWatcher('/repo-a')
      await gitWatcher.setupWatcher('/repo-b')

      gitWatcher.refreshWatchers(['/repo-a', '/repo-b'])

      // Neither watcher should be closed
      expect(closeMock).not.toHaveBeenCalled()
    })
  })

  describe('refreshWatchersAsync', () => {
    it('sets up watchers for git roots found via findGitRoot', async () => {
      mockExists.mockResolvedValue(true)
      const closeMock = vi.fn()
      mockFsWatch.mockReturnValue({ close: closeMock })
      const findGitRoot = vi.fn((path: string) => {
        if (path === '/project/src') return Promise.resolve('/project')
        return Promise.resolve(null)
      })

      await gitWatcher.refreshWatchersAsync(
        ['/project/src', '/no-git'],
        findGitRoot,
      )

      expect(mockFsWatch).toHaveBeenCalledWith(
        '/project/.git/HEAD',
        expect.any(Function),
      )
    })

    it('tears down watchers for roots not in folders', async () => {
      mockExists.mockResolvedValue(true)
      const closeMock = vi.fn()
      mockFsWatch.mockReturnValue({ close: closeMock })
      const findGitRoot = vi.fn(() => Promise.resolve(null))

      // Set up a watcher first
      await gitWatcher.setupWatcher('/old-repo')

      // Refresh with different folders
      await gitWatcher.refreshWatchersAsync(['/new-project'], findGitRoot)

      // Old watcher should be closed
      expect(closeMock).toHaveBeenCalled()
    })

    it('handles HEAD watch error gracefully', async () => {
      mockExists.mockResolvedValue(true)
      // First call (HEAD) throws
      mockFsWatch
        .mockImplementationOnce(() => {
          throw new Error('permission denied')
        })
        // Second call (index) succeeds
        .mockReturnValueOnce({ close: vi.fn() })
      const findGitRoot = vi.fn(() => Promise.resolve('/project'))

      // Should not throw
      await gitWatcher.refreshWatchersAsync(['/project'], findGitRoot)
      // Index watcher should still be set up
      expect(mockFsWatch).toHaveBeenCalledWith(
        '/project/.git/index',
        expect.any(Function),
      )
    })
  })
})
