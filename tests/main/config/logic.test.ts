import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    get isPackaged() {
      return mockIsPackaged.value
    },
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
}))

import {
  getBundledResourcesPath,
  getIgnorePatterns,
  loadConfig,
  restoreAynitePlaybook,
  saveConfig,
} from '../../../src/main/config/logic'

describe('config/logic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getBundledResourcesPath', () => {
    it('returns resources path when packaged', () => {
      mockIsPackaged.value = true
      ;(process as any).resourcesPath = '/packaged/resources'

      const result = getBundledResourcesPath()
      expect(result).toBe('/packaged/resources')

      mockIsPackaged.value = false
      delete (process as any).resourcesPath
    })

    it('returns join of cwd and resources in dev mode', () => {
      mockIsPackaged.value = false
      const cwdMock = vi.spyOn(process, 'cwd').mockReturnValue('/dev/project')
      const result = getBundledResourcesPath()
      expect(result).toBe('/dev/project/resources')
      cwdMock.mockRestore()
    })
  })

  describe('getIgnorePatterns', () => {
    it('returns patterns from ignore file', async () => {
      mockExists.mockResolvedValue(true)
      mockReadText.mockResolvedValue('node_modules\n.DS_Store\ndist\n')

      const result = await getIgnorePatterns()
      expect(result).toEqual(['node_modules', '.DS_Store', 'dist'])
    })

    it('filters out comments and empty lines', async () => {
      mockExists.mockResolvedValue(true)
      mockReadText.mockResolvedValue(
        '# dependencies\nnode_modules\n\n# build output\ndist\n',
      )

      const result = await getIgnorePatterns()
      expect(result).toEqual(['node_modules', 'dist'])
    })

    it('returns defaults when ignore file missing', async () => {
      mockExists.mockResolvedValue(false)

      const result = await getIgnorePatterns()
      expect(result).toEqual(['.git', 'node_modules'])
    })

    it('returns defaults on read error', async () => {
      mockExists.mockResolvedValue(true)
      mockReadText.mockRejectedValue(new Error('read failed'))

      const result = await getIgnorePatterns()
      expect(result).toEqual(['.git', 'node_modules'])
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

  describe('restoreAynitePlaybook', () => {
    it('skips copy if Welcome.md already exists', async () => {
      mockJoinPaths.mockReturnValue('/mock/.aynite/aynite-playbook/Welcome.md')
      mockExists.mockResolvedValue(true)

      const result = await restoreAynitePlaybook()
      expect(result).toBe(true)
      expect(mockCopy).not.toHaveBeenCalled()
    })

    it('copies playbook from bundled resources', async () => {
      mockJoinPaths.mockImplementation((...args: string[]) => args.join('/'))
      mockExists
        .mockResolvedValueOnce(false) // Welcome.md doesn't exist
        .mockResolvedValueOnce(true) // srcDir exists
      mockCopy.mockResolvedValue(undefined)

      const result = await restoreAynitePlaybook()
      expect(result).toBe(true)
      expect(mockCopy).toHaveBeenCalled()
    })

    it('returns false if bundled playbook not found', async () => {
      mockJoinPaths.mockImplementation((...args: string[]) => args.join('/'))
      mockExists
        .mockResolvedValueOnce(false) // Welcome.md doesn't exist
        .mockResolvedValueOnce(false) // srcDir doesn't exist either

      const result = await restoreAynitePlaybook()
      expect(result).toBe(false)
    })

    it('returns false on copy error', async () => {
      mockJoinPaths.mockImplementation((...args: string[]) => args.join('/'))
      mockExists
        .mockResolvedValueOnce(false) // Welcome.md doesn't exist
        .mockResolvedValueOnce(true) // srcDir exists
      mockCopy.mockRejectedValue(new Error('copy failed'))

      const result = await restoreAynitePlaybook()
      expect(result).toBe(false)
    })
  })

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
    })
  })
})
