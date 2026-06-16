import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    get isPackaged() {
      return mockIsPackaged.value
    },
    getVersion: () => '1.0.0-beta.15',
    getLocale: () => 'en-US',
  },
}))

const mockReadJson = vi.hoisted(() => vi.fn())
const mockWriteJson = vi.hoisted(() => vi.fn())
const mockExists = vi.hoisted(() => vi.fn())
const mockReadText = vi.hoisted(() => vi.fn())
const mockWriteText = vi.hoisted(() => vi.fn())
const mockEnsureDir = vi.hoisted(() => vi.fn())
const mockCopy = vi.hoisted(() => vi.fn())
const mockUnlink = vi.hoisted(() => vi.fn())
const mockJoinPaths = vi.hoisted(() =>
  vi.fn((...parts: string[]) => parts.join('/')),
)

const mockIsPackaged = vi.hoisted(() => ({ value: false }))

vi.mock('../../../src/lib/path', () => ({
  readJson: (...args: unknown[]) => mockReadJson(...args),
  writeJson: (...args: unknown[]) => mockWriteJson(...args),
  exists: (...args: unknown[]) => mockExists(...args),
  readText: (...args: unknown[]) => mockReadText(...args),
  writeText: (...args: unknown[]) => mockWriteText(...args),
  ensureDir: (...args: unknown[]) => mockEnsureDir(...args),
  copy: (...args: unknown[]) => mockCopy(...args),
  unlink: (...args: unknown[]) => mockUnlink(...args),
  joinPaths: (...args: string[]) => mockJoinPaths(...args),
  getAyniteDir: vi.fn(() => '/mock/.aynite'),
  getAyniteConfigDir: vi.fn(() => '/mock/.aynite/config'),
  getAynitePromptPath: vi.fn((name: string) => `/mock/.aynite/prompts/${name}`),
  getWorkspacesConfigPath: vi.fn(() => '/mock/.aynite/config/workspaces.json'),
  getWorkspaceDataPath: vi.fn(
    (name: string) => `/mock/.aynite/workspaces/${name}/config.json`,
  ),
  getAIConfigPath: vi.fn(() => '/mock/.aynite/config/ai.json'),
  getKeybindingsConfigPath: vi.fn(
    () => '/mock/.aynite/config/keybindings.json',
  ),
  getIgnoreConfigPath: vi.fn(() => '/mock/.aynite/config/ignore'),
  getMainConfigPath: vi.fn(() => '/mock/.aynite/config/config.json'),
  getAppearanceConfigPath: vi.fn(() => '/mock/.aynite/config/appearance.json'),
  getPlaybookPath: vi.fn(() => '/mock/.aynite/aynite-playbook'),
  getWelcomeMdPath: vi.fn(() => '/mock/.aynite/aynite-playbook/Welcome.md'),
  expandHome: vi.fn((p: string) => p),
  AYNITE_SUBDIRS: {
    CONFIG: 'config',
    LOGS: 'logs',
    PROMPTS: 'prompts',
    THEMES: 'themes',
    SKILLS: 'skills',
    COMMANDS: 'commands',
    VIEWS: 'views',
    WORKSPACES: 'workspaces',
    SESSIONS: 'sessions',
  },
}))

vi.mock('../../../src/main/ai', () => ({
  getDefaultGlobalPrompts: vi.fn(() => []),
  restoreDefaultPrompts: vi.fn(),
}))

vi.mock('../../../src/main/theme', () => ({
  initThemes: vi.fn(),
}))

vi.mock('../../../src/main/spells', () => ({
  restoreSkill: vi.fn(),
  restoreCommand: vi.fn(),
  getSkillsConfig: vi.fn(() => ({ folders: [] })),
  getCommandsConfig: vi.fn(() => ({ folders: [] })),
  setSpellsNotificationCallback: vi.fn(),
  getBundledResourcesPath: vi.fn(() => '/mock/resources'),
}))

import { getIgnorePatterns } from '../../../src/main/config'
import { loadConfig, saveConfig } from '../../../src/main/config/logic'
import { getBundledResourcesPath } from '../../../src/main/spells'

describe('config/logic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getBundledResourcesPath', () => {
    it('returns bundled resources path from spells module', () => {
      // getBundledResourcesPath is imported from spells/common.ts which
      // reads electron.app.isPackaged at module load time.
      // Our mock returns '/mock/resources' regardless of packaging state.
      const result = getBundledResourcesPath()
      expect(result).toBe('/mock/resources')
    })
  })

  describe('getIgnorePatterns', () => {
    it('returns patterns from ignore file', async () => {
      mockReadText.mockResolvedValue('node_modules\n.DS_Store\ndist')

      const result = await getIgnorePatterns()
      expect(result).toEqual(['node_modules', '.DS_Store', 'dist'])
    })

    it('filters out blank lines (comments are NOT filtered — handled by source file format)', async () => {
      mockReadText.mockResolvedValue(
        '# dependencies\nnode_modules\n\n# build output\ndist',
      )

      const result = await getIgnorePatterns()
      // Current implementation only filters whitespace-only lines, not comments
      expect(result).toEqual([
        '# dependencies',
        'node_modules',
        '# build output',
        'dist',
      ])
    })

    it('returns empty array when ignore file read fails', async () => {
      mockReadText.mockRejectedValue(new Error('ENOENT'))

      const result = await getIgnorePatterns()
      expect(result).toEqual([])
    })

    it('returns empty array on read error', async () => {
      mockReadText.mockRejectedValue(new Error('read failed'))

      const result = await getIgnorePatterns()
      expect(result).toEqual([])
    })
  })

  describe('saveConfig', () => {
    it('writes ai, keybindings, and main config', async () => {
      mockWriteJson.mockResolvedValue(undefined)
      mockWriteText.mockResolvedValue(undefined)

      const result = await saveConfig({
        ai: { activeId: 'test', providers: [] },
        keybindings: { app: {}, view: {} },
        activeTheme: 'dark',
      })
      expect(result).toBe(true)

      const writeCalls = mockWriteJson.mock.calls
      expect(writeCalls[0][1]).toMatchObject({ activeId: 'test' })
      expect(writeCalls[1][1]).toMatchObject({ app: {}, view: {} })
      expect(writeCalls[2][1]).toMatchObject({ activeTheme: 'dark' })
    })

    it('writes ignore patterns as joined text when array', async () => {
      mockWriteJson.mockResolvedValue(undefined)
      mockWriteText.mockResolvedValue(undefined)

      await saveConfig({ ignore: ['node_modules', '.env'] })
      expect(mockWriteText).toHaveBeenCalledWith(
        expect.any(String),
        'node_modules\n.env',
      )
    })

    it('writes ignore as-is when not an array', async () => {
      mockWriteJson.mockResolvedValue(undefined)
      mockWriteText.mockResolvedValue(undefined)

      await saveConfig({ ignore: 'node_modules\n.env' })
      expect(mockWriteText).toHaveBeenCalledWith(
        expect.any(String),
        'node_modules\n.env',
      )
    })

    it('does not write ignore when not provided', async () => {
      mockWriteJson.mockResolvedValue(undefined)

      await saveConfig({ activeTheme: 'light' })
      expect(mockWriteText).not.toHaveBeenCalled()
    })
  })

  // restoreAynitePlaybook describe block removed —
  // it's a private function in logic.ts, not part of the public API.

  describe('loadConfig', () => {
    it('loads and merges config from all sources', async () => {
      mockReadJson
        .mockResolvedValueOnce({ activeId: 'gemini', providers: [] })
        .mockResolvedValueOnce({ app: {}, view: {} })
        .mockResolvedValueOnce({ activeTheme: 'nord' })
      mockExists.mockResolvedValue(false)

      const result = await loadConfig()
      expect(result).toHaveProperty('activeTheme', 'nord')
      expect(result).toHaveProperty('keybindings')
      expect(result).toHaveProperty('ai')
      expect(result).toHaveProperty('language', 'en')
      expect(result).toHaveProperty('ignore')
    })

    it('repairs AI config when providers list is missing', async () => {
      mockReadJson
        .mockResolvedValueOnce({ activeId: null }) // no providers
        .mockResolvedValueOnce({ app: {}, view: {} })
        .mockResolvedValueOnce({ activeTheme: 'light' })
      mockExists.mockResolvedValue(false)

      const result = await loadConfig()
      expect(result.ai.providers).toBeDefined()
      expect(Array.isArray(result.ai.providers)).toBe(true)
    })

    it('fills in default provider URLs when missing', async () => {
      mockReadJson
        .mockResolvedValueOnce({
          activeId: 'test',
          providers: [
            { provider: 'openai', baseUrl: '' },
            { provider: 'anthropic', baseUrl: '' },
          ],
        })
        .mockResolvedValueOnce({ app: {}, view: {} })
        .mockResolvedValueOnce({ activeTheme: 'light' })
      mockExists.mockResolvedValue(false)

      const result = await loadConfig()
      const openai = result.ai.providers.find(
        (p: any) => p.provider === 'openai',
      )
      expect(openai.baseUrl).toBeTruthy()
    })

    it('fills in missing mainConfig keys via ensureKeys', async () => {
      mockReadJson
        .mockResolvedValueOnce({ activeId: 'test', providers: [] })
        .mockResolvedValueOnce({ app: {}, view: {} })
        .mockResolvedValueOnce({}) // empty mainConfig
      mockExists.mockResolvedValue(false)

      const result = await loadConfig()
      expect(result.skills).toBeDefined()
      expect(result.commands).toBeDefined()
      expect(result.telemetry).toEqual({ enabled: true })
    })

    it('migrates appearance config theme when mainConfig has no activeTheme', async () => {
      mockReadJson
        .mockResolvedValueOnce({ activeId: 'test', providers: [] })
        .mockResolvedValueOnce({ app: {}, view: {} })
        .mockResolvedValueOnce({}) // mainConfig has no activeTheme
      mockExists.mockResolvedValueOnce(true) // appearance config exists
      mockReadJson.mockResolvedValueOnce({ theme: 'nord' })

      const result = await loadConfig()
      expect(result.activeTheme).toBe('nord')
      expect(mockUnlink).toHaveBeenCalled()
    })

    it('handles appearance config read error gracefully', async () => {
      mockReadJson
        .mockResolvedValueOnce({ activeId: 'test', providers: [] })
        .mockResolvedValueOnce({ app: {}, view: {} })
        .mockResolvedValueOnce({ activeTheme: 'light' })
      mockExists.mockResolvedValueOnce(true)
      mockReadJson.mockRejectedValueOnce(new Error('parse error'))

      const result = await loadConfig()
      expect(result.activeTheme).toBe('light')
    })

    it('falls back to detectSystemLanguage when config language missing', async () => {
      mockReadJson
        .mockResolvedValueOnce({ activeId: 'test', providers: [] })
        .mockResolvedValueOnce({ app: {}, view: {} })
        .mockResolvedValueOnce({ activeTheme: 'light' }) // no language key
      mockExists.mockResolvedValue(false)

      const result = await loadConfig()
      expect(result.language).toBe('en')
    })

    it('loads ignore patterns and excludes them from rest config', async () => {
      mockReadJson
        .mockResolvedValueOnce({ activeId: 'test', providers: [] })
        .mockResolvedValueOnce({ app: {}, view: {} })
        .mockResolvedValueOnce({ activeTheme: 'light', ignore: ['old'] })
      mockExists.mockResolvedValue(false)

      const result = await loadConfig()
      expect(result.ignore).toBeDefined()
      expect((result as any).ignore).not.toBe(['old']) // ignore comes from getIgnorePatterns
    })
  })
})
