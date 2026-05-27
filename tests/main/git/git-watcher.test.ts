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
})
