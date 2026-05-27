import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRootFinder } from '../../../src/main/git/root-finder'

const mockExists = vi.hoisted(() => vi.fn())

vi.mock('../../../src/lib/path', () => ({
  exists: (...args: unknown[]) => mockExists(...args),
  getAbsolutePath: vi.fn((p: string) => p),
  getDirname: vi.fn((p: string) => {
    const parts = p.split('/')
    parts.pop()
    return parts.join('/') || '/'
  }),
  joinPaths: vi.fn((...parts: string[]) => parts.join('/')),
}))

describe('createRootFinder', () => {
  let rootFinder: ReturnType<typeof createRootFinder>

  beforeEach(() => {
    vi.clearAllMocks()
    rootFinder = createRootFinder()
  })

  it('returns root when .git is in the path directory', async () => {
    mockExists.mockImplementation((p: string) => p === '/repo/.git')
    const result = await rootFinder.findGitRoot('/repo/src/file.ts')
    expect(result).toBe('/repo')
  })

  it('walks up parent directories to find .git', async () => {
    mockExists.mockImplementation((p: string) => p === '/repo/.git')
    const result = await rootFinder.findGitRoot('/repo/src/deep/nested/file.ts')
    expect(result).toBe('/repo')
  })

  it('returns null for path outside any git repo', async () => {
    mockExists.mockResolvedValue(false)
    const result = await rootFinder.findGitRoot('/tmp/some-file')
    expect(result).toBeNull()
  })

  it('uses cached result on subsequent call', async () => {
    mockExists.mockImplementation((p: string) => p === '/repo/.git')
    // First call — walks up, finds /repo
    await rootFinder.findGitRoot('/repo/src/file.ts')
    expect(mockExists).toHaveBeenCalled()

    vi.clearAllMocks()

    // Second call — should use cache, not call exists
    const result = await rootFinder.findGitRoot('/repo/src/file.ts')
    expect(result).toBe('/repo')
    expect(mockExists).not.toHaveBeenCalled()
  })

  it('stops at filesystem root boundary', async () => {
    mockExists.mockResolvedValue(false)
    const result = await rootFinder.findGitRoot('/')
    expect(result).toBeNull()
  })

  it('clearCache resets cached entries', async () => {
    mockExists.mockImplementation((p: string) => p === '/repo/.git')
    await rootFinder.findGitRoot('/repo/file.ts')
    rootFinder.clearCache()

    vi.clearAllMocks()
    mockExists.mockImplementation((p: string) => p === '/repo/.git')

    // Should walk again since cache is cleared
    const result = await rootFinder.findGitRoot('/repo/file.ts')
    expect(result).toBe('/repo')
    expect(mockExists).toHaveBeenCalled()
  })

  it('caches null results too (no .git found)', async () => {
    mockExists.mockResolvedValue(false)
    await rootFinder.findGitRoot('/outside/file.ts')

    vi.clearAllMocks()

    const result = await rootFinder.findGitRoot('/outside/file.ts')
    expect(result).toBeNull()
    expect(mockExists).not.toHaveBeenCalled()
  })
})
