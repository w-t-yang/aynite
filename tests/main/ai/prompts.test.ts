import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Mocks ──────────────────────────────────────────────────────────────

const mockReadJson = vi.hoisted(() => vi.fn())
const mockReadText = vi.hoisted(() => vi.fn())
const mockWriteJson = vi.hoisted(() => vi.fn())
const mockWriteText = vi.hoisted(() => vi.fn())
const mockExists = vi.hoisted(() => vi.fn())
const mockEnsureDir = vi.hoisted(() => vi.fn())

vi.mock('../../../src/lib/path', () => ({
  readJson: (...args: unknown[]) => mockReadJson(...args),
  readText: (...args: unknown[]) => mockReadText(...args),
  writeJson: (...args: unknown[]) => mockWriteJson(...args),
  writeText: (...args: unknown[]) => mockWriteText(...args),
  exists: (...args: unknown[]) => mockExists(...args),
  ensureDir: (...args: unknown[]) => mockEnsureDir(...args),
  getAynitePromptPath: vi.fn((name: string) => `/mock/.aynite/prompts/${name}`),
  getAynitePromptsDir: vi.fn(() => '/mock/.aynite/prompts'),
  getMainConfigPath: vi.fn(() => '/mock/.aynite/config/config.json'),
}))

import {
  ensureDefaultPromptFiles,
  getDefaultGlobalPrompts,
  getMergedSystemPrompt,
  getPromptsConfig,
  restoreDefaultPrompts,
} from '../../../src/main/ai/prompts'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('prompts', () => {
  describe('getDefaultGlobalPrompts', () => {
    it('returns paths for all global prompts', () => {
      const paths = getDefaultGlobalPrompts()
      expect(Array.isArray(paths)).toBe(true)
      expect(paths.length).toBeGreaterThan(0)
      expect(paths[0]).toContain('/mock/.aynite/prompts/')
    })
  })

  describe('getPromptsConfig', () => {
    it('returns prompts from config', async () => {
      mockReadJson.mockResolvedValue({
        prompts: { files: ['/prompts/about-me.md'] },
      })
      const files = await getPromptsConfig()
      expect(files).toEqual(['/prompts/about-me.md'])
    })

    it('falls back to defaults when config missing', async () => {
      mockReadJson.mockResolvedValue({})
      const files = await getPromptsConfig()
      expect(files.length).toBeGreaterThan(0)
    })
  })

  describe('getMergedSystemPrompt', () => {
    it('merges content from multiple files', async () => {
      mockReadText
        .mockResolvedValueOnce('# About Me\nI am Aynite.')
        .mockResolvedValueOnce('# About Skills\nI can use tools.')

      const result = await getMergedSystemPrompt(
        ['/prompts/about-me.md'],
        ['/prompts/about-skills.md'],
      )

      expect(result).toContain('# About Me')
      expect(result).toContain('# About Skills')
    })

    it('trims final result', async () => {
      mockReadText.mockResolvedValue('content\n\n')
      const result = await getMergedSystemPrompt(['/prompts/test.md'])
      expect(result).toBe('content')
    })

    it('returns empty string when no files', async () => {
      const result = await getMergedSystemPrompt([], [])
      expect(result).toBe('')
    })
  })

  describe('ensureDefaultPromptFiles', () => {
    it('creates missing prompt files', async () => {
      mockExists.mockResolvedValue(false)
      mockWriteText.mockResolvedValue(undefined)

      await ensureDefaultPromptFiles()

      expect(mockEnsureDir).toHaveBeenCalledWith('/mock/.aynite/prompts')
      expect(mockWriteText).toHaveBeenCalled()
    })

    it('skips existing prompt files', async () => {
      mockExists.mockResolvedValue(true)

      await ensureDefaultPromptFiles()

      expect(mockWriteText).not.toHaveBeenCalled()
    })
  })

  describe('restoreDefaultPrompts', () => {
    it('writes all prompts and updates config', async () => {
      mockReadJson.mockResolvedValue({})
      mockWriteText.mockResolvedValue(undefined)
      mockWriteJson.mockResolvedValue(undefined)

      const result = await restoreDefaultPrompts()

      expect(result).toHaveProperty('prompts')
      expect(result).toHaveProperty('agents')
      expect(mockWriteText).toHaveBeenCalled()
      expect(mockWriteJson).toHaveBeenCalled()
    })
  })
})
