import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Mocks ──────────────────────────────────────────────────────────────

const mockExists = vi.hoisted(() => vi.fn())
const mockReadJson = vi.hoisted(() => vi.fn())
const mockReaddir = vi.hoisted(() => vi.fn())
const mockRemove = vi.hoisted(() => vi.fn())
const mockCopy = vi.hoisted(() => vi.fn())

vi.mock('../../../src/lib/path', () => ({
  exists: (...args: unknown[]) => mockExists(...args),
  readJson: (...args: unknown[]) => mockReadJson(...args),
  readdir: (...args: unknown[]) => mockReaddir(...args),
  remove: (...args: unknown[]) => mockRemove(...args),
  copy: (...args: unknown[]) => mockCopy(...args),
  getAyniteDir: () => '/mock/.aynite',
  joinPaths: (...parts: string[]) => parts.join('/'),
  AYNITE_SUBDIRS: { VIEWS: 'views' },
}))

const mockGetVersion = vi.hoisted(() => vi.fn(() => '0.1.8'))
const mockIsPackaged = vi.hoisted(() => ({ value: false }))

vi.mock('electron', () => ({
  app: {
    get isPackaged() {
      return mockIsPackaged.value
    },
    getVersion: () => mockGetVersion(),
    get resourcesPath() {
      return '/mock/resources'
    },
  },
}))

// Must import AFTER mocks are set up
import {
  getAvailableViews,
  getShellConfig,
  isVersionLowerThan,
  restoreViewFromBundle,
  validateAndMaybeRestoreView,
} from '../../../src/main/system/logic'

describe('system/logic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsPackaged.value = false
    mockGetVersion.mockReturnValue('0.1.8')
  })

  // ── isVersionLowerThan ──────────────────────────────────────────────────

  describe('isVersionLowerThan', () => {
    it('returns false for identical versions', () => {
      expect(isVersionLowerThan('0.1.0', '0.1.0')).toBe(false)
    })

    it('returns true for patch bump', () => {
      expect(isVersionLowerThan('0.1.5', '0.1.6')).toBe(true)
    })

    it('returns false when first version is greater', () => {
      expect(isVersionLowerThan('0.2.0', '0.1.0')).toBe(false)
    })

    it('returns true for minor bump', () => {
      expect(isVersionLowerThan('0.1.5', '0.2.0')).toBe(true)
    })

    it('returns true for major bump', () => {
      expect(isVersionLowerThan('0.1.0', '1.0.0')).toBe(true)
    })

    it('handles beta vs release (beta is lower)', () => {
      // '0.1.0-beta.1' splits to [0, 1, 0, NaN, 1]
      // '0.1.0' splits to [0, 1, 0]
      // At index 3: undefined (b) → uses (i >= 3 ? -1 : 0) → -1
      // NaN (a) is not > -1 nor < -1, so they don't differ
      // Since no difference found, returns false
      expect(isVersionLowerThan('0.1.0-beta.1', '0.1.0')).toBe(false)
    })

    it('handles prerelease ordering (beta.1 < beta.2)', () => {
      // Both split to: [0, 1, 0, NaN, 1] and [0, 1, 0, NaN, 2]
      // NaN comparison always returns false → no diff found → returns false
      expect(isVersionLowerThan('0.1.0-beta.1', '0.1.0-beta.2')).toBe(false)
    })

    it('handles different length parts (0.1 < 0.1.0)', () => {
      // [0, 1] vs [0, 1, 0]
      // At index 2: undefined (a) → i=2 >= 3? No → uses 0. So 0 < 0 = false
      expect(isVersionLowerThan('0.1', '0.1.0')).toBe(false)
    })

    it('handles different length parts (0.1.0 < 0.1)', () => {
      // [0, 1, 0] vs [0, 1]
      // At index 2: 0 (a) vs undefined (b) → b: i=2 >= 3? No → uses 0. So 0 < 0 = false
      expect(isVersionLowerThan('0.1.0', '0.1')).toBe(false)
    })
  })

  // ── getShellConfig ──────────────────────────────────────────────────────

  describe('getShellConfig', () => {
    it('returns Unix config on the current platform', () => {
      // This test runs on the actual OS — on macOS/Linux it should return
      // the Unix shell config. On Windows the behavior would differ.
      const config = getShellConfig()
      expect(config.args).toEqual(['-l', '-c'])
      expect(config.isWindows).toBe(false)
      expect(config.isPowershell).toBe(false)
    })

    it('returns a shell path from SHELL env or platform default', () => {
      // Save original, stub, test, restore
      const origShell = process.env.SHELL
      vi.stubEnv('SHELL', '/usr/local/bin/fish')
      const config = getShellConfig()
      expect(config.shell).toBe('/usr/local/bin/fish')
      vi.unstubAllEnvs()
      if (origShell !== undefined) {
        process.env.SHELL = origShell
      }
    })
  })

  // ── restoreViewFromBundle ───────────────────────────────────────────────

  describe('restoreViewFromBundle', () => {
    it('returns false when bundled view does not exist', async () => {
      mockExists.mockResolvedValue(false)
      const result = await restoreViewFromBundle('some-view')
      expect(result).toBe(false)
      expect(mockRemove).not.toHaveBeenCalled()
      expect(mockCopy).not.toHaveBeenCalled()
    })

    it('removes runtime dir and copies bundled view', async () => {
      mockExists.mockResolvedValue(true)
      mockRemove.mockResolvedValue(undefined)
      mockCopy.mockResolvedValue(undefined)

      const result = await restoreViewFromBundle('my-view')

      expect(result).toBe(true)
      expect(mockRemove).toHaveBeenCalledWith('/mock/.aynite/views/my-view', {
        recursive: true,
        force: true,
      })
      // In dev mode, bundled views are at <cwd>/resources/dist-views/views/my-view
      expect(mockCopy).toHaveBeenCalledWith(
        expect.stringContaining('resources/dist-views/views/my-view'),
        '/mock/.aynite/views/my-view',
        { recursive: true },
      )
    })

    it('returns false when copy fails', async () => {
      mockExists.mockResolvedValue(true)
      mockRemove.mockResolvedValue(undefined)
      mockCopy.mockRejectedValue(new Error('copy failed'))

      const result = await restoreViewFromBundle('my-view')
      expect(result).toBe(false)
    })
  })

  // ── validateAndMaybeRestoreView ─────────────────────────────────────────

  describe('validateAndMaybeRestoreView', () => {
    it('returns false when config.json does not exist', async () => {
      mockExists.mockResolvedValue(false)
      const result = await validateAndMaybeRestoreView('missing-view')
      expect(result).toBe(false)
      expect(mockReadJson).not.toHaveBeenCalled()
    })

    it('returns false when config has no aynite-version', async () => {
      mockExists.mockResolvedValue(true) // config.json exists
      mockReadJson.mockResolvedValue({ name: 'Chart' })
      const result = await validateAndMaybeRestoreView('chart-view')
      expect(result).toBe(false)
    })

    it('returns false when aynite-version is not a string', async () => {
      mockExists.mockResolvedValue(true)
      mockReadJson.mockResolvedValue({ 'aynite-version': 123 })
      const result = await validateAndMaybeRestoreView('chart-view')
      expect(result).toBe(false)
    })

    it('returns true when version matches app version', async () => {
      mockExists.mockResolvedValue(true)
      mockReadJson.mockResolvedValue({ 'aynite-version': '0.1.8' })
      mockGetVersion.mockReturnValue('0.1.8')

      const result = await validateAndMaybeRestoreView('chart-view')
      expect(result).toBe(true)
      // Should not trigger restore
      expect(mockCopy).not.toHaveBeenCalled()
      expect(mockRemove).not.toHaveBeenCalled()
    })

    it('returns true when view version is higher than app version', async () => {
      mockExists.mockResolvedValue(true)
      mockReadJson.mockResolvedValue({ 'aynite-version': '0.2.0' })
      mockGetVersion.mockReturnValue('0.1.8')

      const result = await validateAndMaybeRestoreView('chart-view')
      expect(result).toBe(true)
      expect(mockCopy).not.toHaveBeenCalled()
    })

    it('restores from bundle when view version is lower', async () => {
      mockExists
        .mockResolvedValueOnce(true) // config.json exists
        .mockResolvedValueOnce(true) // bundled view exists (called by restoreViewFromBundle)
      mockReadJson.mockResolvedValue({ 'aynite-version': '0.1.0' })
      mockGetVersion.mockReturnValue('0.1.8')
      mockRemove.mockResolvedValue(undefined)
      mockCopy.mockResolvedValue(undefined)

      const result = await validateAndMaybeRestoreView('chart-view')
      expect(result).toBe(true)
      expect(mockRemove).toHaveBeenCalled()
      expect(mockCopy).toHaveBeenCalled()
    })
  })

  // ── getAvailableViews ───────────────────────────────────────────────────

  describe('getAvailableViews', () => {
    function dirent(name: string, isDir: boolean) {
      return { name, isDirectory: () => isDir }
    }

    it('returns empty when views dir does not exist', async () => {
      mockExists.mockResolvedValue(false)
      const result = await getAvailableViews()
      expect(result).toEqual([])
    })

    it('returns validated views with transformed names', async () => {
      // First exists is for viewsDir, second is for index.html
      mockExists.mockResolvedValue(true)
      mockReaddir.mockResolvedValue([
        dirent('aichat', true),
        dirent('file-browser', true),
        dirent('treeview', true),
        dirent('rss', true),
      ])
      // Config read for each view: all have valid aynite-version
      mockReadJson.mockResolvedValue({ 'aynite-version': '0.1.8' })

      const result = await getAvailableViews()
      expect(result).toHaveLength(4)
      expect(result[0]).toEqual({ id: 'aichat', name: 'AI Chat' })
      expect(result[1]).toEqual({ id: 'file-browser', name: 'File Browser' })
      expect(result[2]).toEqual({ id: 'treeview', name: 'File Explorer' })
      expect(result[3]).toEqual({ id: 'rss', name: 'Rss' })
    })

    it('skips views without index.html', async () => {
      mockExists
        .mockResolvedValueOnce(true) // viewsDir exists
        .mockResolvedValueOnce(false) // index.html does NOT exist
      mockReaddir.mockResolvedValue([dirent('incomplete-view', true)])

      const result = await getAvailableViews()
      expect(result).toEqual([])
    })

    it('skips views that fail validation (no aynite-version)', async () => {
      mockExists
        .mockResolvedValueOnce(true) // viewsDir
        .mockResolvedValueOnce(true) // index.html
      mockReaddir.mockResolvedValue([dirent('user-custom-view', true)])
      mockReadJson.mockResolvedValue({ name: 'Custom' }) // no aynite-version

      const result = await getAvailableViews()
      expect(result).toEqual([])
    })

    it('skips non-directory entries', async () => {
      mockExists.mockResolvedValue(true)
      mockReaddir.mockResolvedValue([
        dirent('file.txt', false),
        dirent('aichat', true),
      ])
      mockReadJson.mockResolvedValue({ 'aynite-version': '0.1.8' })

      const result = await getAvailableViews()
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('aichat')
    })
  })
})
