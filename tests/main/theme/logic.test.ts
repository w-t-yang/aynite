import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Mocks ──────────────────────────────────────────────────────────────

const mockExists = vi.hoisted(() => vi.fn())
const mockReaddir = vi.hoisted(() => vi.fn())
const mockReadJson = vi.hoisted(() => vi.fn())
const mockWriteJson = vi.hoisted(() => vi.fn())
const mockUnlink = vi.hoisted(() => vi.fn())
const mockEnsureDir = vi.hoisted(() => vi.fn())

vi.mock('../../../src/lib/path', () => ({
  exists: (...args: unknown[]) => mockExists(...args),
  readdir: (...args: unknown[]) => mockReaddir(...args),
  readJson: (...args: unknown[]) => mockReadJson(...args),
  writeJson: (...args: unknown[]) => mockWriteJson(...args),
  unlink: (...args: unknown[]) => mockUnlink(...args),
  ensureDir: (...args: unknown[]) => mockEnsureDir(...args),
  getThemePath: vi.fn((name: string) => `/mock/.aynite/themes/${name}.json`),
  getThemesDir: vi.fn(() => '/mock/.aynite/themes'),
  getBasename: vi.fn((p: string, ext?: string) => {
    const name = p.split('/').pop() || p
    return ext ? name.replace(ext, '') : name
  }),
}))

import {
  deleteTheme,
  getTheme,
  getThemesList,
  initThemes,
  restoreDefaultTheme,
  saveTheme,
} from '../../../src/main/theme/logic'

beforeEach(() => {
  vi.clearAllMocks()
})

function dirent(name: string) {
  return { name, isDirectory: () => false }
}

describe('theme/logic', () => {
  describe('getThemesList', () => {
    it('returns list of themes from themes dir', async () => {
      mockReaddir.mockResolvedValue([dirent('light.json'), dirent('dark.json')])
      mockReadJson
        .mockResolvedValueOnce({ name: 'Light', colors: {} })
        .mockResolvedValueOnce({ name: 'Dark', colors: {} })

      const themes = await getThemesList()

      expect(themes).toHaveLength(2)
      expect(themes[0].id).toBe('light')
      expect(themes[0].name).toBe('Light')
      expect(themes[1].id).toBe('dark')
    })

    it('returns empty array when themes dir read fails', async () => {
      mockReaddir.mockRejectedValue(new Error('ENOENT'))

      const themes = await getThemesList()
      expect(themes).toEqual([])
    })
  })

  describe('getTheme', () => {
    it('returns theme by name', async () => {
      mockReadJson.mockResolvedValue({
        name: 'Nord',
        colors: { bg: '#2E3440' },
      })

      const theme = await getTheme('nord')
      expect(theme.name).toBe('Nord')
    })

    it('returns light fallback when theme not found', async () => {
      mockReadJson.mockRejectedValue(new Error('ENOENT'))

      const theme = await getTheme('nonexistent')
      expect(theme).toBeDefined()
    })
  })

  describe('saveTheme', () => {
    it('writes theme to file', async () => {
      const result = await saveTheme('custom', {
        name: 'Custom',
        colors: { bg: '#000' },
      })

      expect(result).toBe(true)
      expect(mockWriteJson).toHaveBeenCalledWith(
        '/mock/.aynite/themes/custom.json',
        { name: 'Custom', colors: { bg: '#000' } },
      )
    })
  })

  describe('deleteTheme', () => {
    it('deletes a custom theme file', async () => {
      mockExists.mockResolvedValue(true)

      const result = await deleteTheme('custom-theme')

      expect(result).toBe(true)
      expect(mockUnlink).toHaveBeenCalledWith(
        '/mock/.aynite/themes/custom-theme.json',
      )
    })

    it('does not delete built-in default themes', async () => {
      const result = await deleteTheme('light')
      expect(result).toBe(false)
      expect(mockUnlink).not.toHaveBeenCalled()
    })

    it('returns false when theme file does not exist', async () => {
      mockExists.mockResolvedValue(false)

      const result = await deleteTheme('custom')
      expect(result).toBe(false)
    })
  })

  describe('restoreDefaultTheme', () => {
    it('restores a built-in default theme', async () => {
      const result = await restoreDefaultTheme('light')
      expect(result).toBe(true)
      expect(mockWriteJson).toHaveBeenCalled()
    })

    it('returns false for unknown theme', async () => {
      const result = await restoreDefaultTheme('unknown')
      expect(result).toBe(false)
    })
  })

  describe('initThemes', () => {
    it('creates default theme files when missing', async () => {
      mockExists.mockResolvedValue(false)
      mockWriteJson.mockResolvedValue(undefined)

      await initThemes()

      expect(mockEnsureDir).toHaveBeenCalledWith('/mock/.aynite/themes')
      expect(mockWriteJson).toHaveBeenCalled()
    })

    it('skips existing theme files', async () => {
      mockExists.mockResolvedValue(true)

      await initThemes()

      expect(mockWriteJson).not.toHaveBeenCalled()
    })
  })
})
