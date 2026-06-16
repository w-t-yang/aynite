import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Mocks: system boundaries ───────────────────────────────────────────

const mockGetVersion = vi.hoisted(() => vi.fn(() => '0.1.8'))
const mockGetLocale = vi.hoisted(() => vi.fn(() => 'en-US'))
const mockIsPackaged = vi.hoisted(() => ({ value: false }))

vi.mock('electron', () => ({
  app: {
    get isPackaged() {
      return mockIsPackaged.value
    },
    getVersion: () => mockGetVersion(),
    getLocale: () => mockGetLocale(),
    get resourcesPath() {
      return '/mock/resources'
    },
  },
}))

const mockReadJson = vi.hoisted(() => vi.fn())
const mockExists = vi.hoisted(() => vi.fn())
const mockReaddir = vi.hoisted(() => vi.fn())
const mockReadText = vi.hoisted(() => vi.fn())
const mockWriteJson = vi.hoisted(() => vi.fn())

const mockGetPlaybookPath = vi.hoisted(() =>
  vi.fn(() => '/mock/.aynite/aynite-playbook'),
)
const mockGetViewConfigPath = vi.hoisted(() =>
  vi.fn((name: string) => `/mock/.aynite/views/${name}/config.json`),
)
const mockGetMainConfigPath = vi.hoisted(() =>
  vi.fn(() => '/mock/.aynite/config/config.json'),
)
const mockGetAynitePath = vi.hoisted(() =>
  vi.fn((...parts: string[]) => ['/mock/.aynite', ...parts].join('/')),
)
const mockGetKeybindingsConfigPath = vi.hoisted(() =>
  vi.fn(() => '/mock/.aynite/config/keybindings.json'),
)
const mockGetAIConfigPath = vi.hoisted(() =>
  vi.fn(() => '/mock/.aynite/config/ai.json'),
)

vi.mock('../../../src/lib/path', () => ({
  exists: (...args: unknown[]) => mockExists(...args),
  readJson: (...args: unknown[]) => mockReadJson(...args),
  readdir: (...args: unknown[]) => mockReaddir(...args),
  readText: (...args: unknown[]) => mockReadText(...args),
  writeJson: (...args: unknown[]) => mockWriteJson(...args),
  getPlaybookPath: (...args: unknown[]) => mockGetPlaybookPath(...args),
  getViewConfigPath: (...args: unknown[]) => mockGetViewConfigPath(...args),
  getMainConfigPath: (...args: unknown[]) => mockGetMainConfigPath(...args),
  getAynitePath: (...args: unknown[]) => mockGetAynitePath(...args),
  getKeybindingsConfigPath: (...args: unknown[]) =>
    mockGetKeybindingsConfigPath(...args),
  getAIConfigPath: (...args: unknown[]) => mockGetAIConfigPath(...args),
  AYNITE_SUBDIRS: { VIEWS: 'views', CONFIG: 'config' },
  expandHome: vi.fn((p: string) => p),
  getAbsolutePath: vi.fn((p: string) => p),
  joinPaths: vi.fn((...parts: string[]) => parts.join('/')),
  getDirname: vi.fn((p: string) => p.split('/').slice(0, -1).join('/')),
  getRelativePath: vi.fn((from: string, to: string) =>
    to.replace(`${from}/`, ''),
  ),
}))

// Mock dependencies used by the handlers
vi.mock('../../../src/main/ai', () => ({
  getMergedSystemPrompt: vi.fn(() => 'merged-system-prompt'),
  getToolsMetadata: vi.fn(() => [
    {
      name: 'read_file',
      description: 'Read a file',
      inputSchema: { type: 'object' },
    },
  ]),
  listSessions: vi.fn(() => [{ id: 'session-1', date: '2026-06-15' }]),
  loadSession: vi.fn(() => ({ id: 'session-1', messages: [] })),
  saveSession: vi.fn(),
  deleteSession: vi.fn(),
}))

vi.mock('../../../src/main/system/logic', () => ({
  isVersionLowerThan: vi.fn(() => false),
  restoreViewFromBundle: vi.fn(() => true),
}))

vi.mock('../../../src/main/config/schema-validator', () => ({
  validateAgainstSchema: vi.fn(() => true),
}))

const mockGetWorkspaceState = vi.hoisted(() => vi.fn())
const mockGetWorkspacesList = vi.hoisted(() => vi.fn())
const mockSaveWorkspaceState = vi.hoisted(() => vi.fn())
const mockUpdateTileData = vi.hoisted(() => vi.fn())

vi.mock('../../../src/main/workspace', () => ({
  getWorkspacesList: (...args: unknown[]) => mockGetWorkspacesList(...args),
  getWorkspaceState: (...args: unknown[]) => mockGetWorkspaceState(...args),
  saveWorkspaceState: (...args: unknown[]) => mockSaveWorkspaceState(...args),
  updateTileData: (...args: unknown[]) => mockUpdateTileData(...args),
}))

vi.mock('../../../src/main/window', () => ({
  sendToWindow: vi.fn(),
}))

const mockGetWindowWorkspace = vi.hoisted(() => vi.fn(() => 'MockWorkspace'))

vi.mock('../../../src/main/window-state', () => ({
  getWindowWorkspace: (...args: unknown[]) => mockGetWindowWorkspace(...args),
}))

vi.mock('../../../src/main/config/logic', () => ({
  loadConfig: vi.fn(() => ({
    keybindings: { app: {}, view: {} },
    ai: { activeId: 'test', providers: [] },
    agents: { activeId: 'aynite', list: [{ id: 'aynite', name: 'Aynite' }] },
    prompts: { files: ['global-prompt.md'] },
    skills: { folders: ['/mock/.aynite/skills'] },
    commands: { folders: ['/mock/.aynite/commands'] },
  })),
}))

import { aiHandlers } from '../../../src/main/config/handlers/ai-handlers'
import { configFileHandlers } from '../../../src/main/config/handlers/config-file-handlers'
import { staticHandlers } from '../../../src/main/config/handlers/static-handlers'
import { telemetryHandlers } from '../../../src/main/config/handlers/telemetry-handlers'
import { workspaceStateHandlers } from '../../../src/main/config/handlers/workspace-state-handlers'

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── Static Handlers ────────────────────────────────────────────────────

describe('staticHandlers', () => {
  describe('get', () => {
    it('returns app version for version key', async () => {
      const result = await staticHandlers.get?.('version', undefined)
      expect(result).toBe('0.1.8')
    })

    it('returns playbook path for playbook-path key', async () => {
      const result = await staticHandlers.get?.('playbook-path', undefined)
      expect(result).toBe('/mock/.aynite/aynite-playbook')
    })

    it('returns saved language from config', async () => {
      mockReadJson.mockResolvedValue({ language: 'zh' })
      const result = await staticHandlers.get?.('language', undefined)
      expect(result).toBe('zh')
    })

    it('falls back to detectSystemLanguage when language missing', async () => {
      mockReadJson.mockResolvedValue({})
      mockGetLocale.mockReturnValue('zh-CN')
      const result = await staticHandlers.get?.('language', undefined)
      expect(result).toBe('zh')
    })

    it('falls back to en for non-Chinese locales', async () => {
      mockReadJson.mockResolvedValue({})
      mockGetLocale.mockReturnValue('fr-FR')
      const result = await staticHandlers.get?.('language', undefined)
      expect(result).toBe('en')
    })

    it('returns null for view-config when no view name', async () => {
      const result = await staticHandlers.get?.('view-config', {})
      expect(result).toBeNull()
    })

    it('returns null for view-config when config not found', async () => {
      mockReadJson.mockResolvedValue(null)
      const result = await staticHandlers.get?.('view-config', {
        view: 'missing-view',
      })
      expect(result).toBeNull()
    })

    it('returns null for view-config when aynite-version missing', async () => {
      mockReadJson.mockResolvedValue({ name: 'Chart' })
      const result = await staticHandlers.get?.('view-config', {
        view: 'dataview-chart',
      })
      expect(result).toBeNull()
    })

    it('returns config when aynite-version matches', async () => {
      mockReadJson.mockResolvedValue({
        name: 'Chart',
        'aynite-version': '0.1.8',
      })
      mockGetVersion.mockReturnValue('0.1.8')
      const result = await staticHandlers.get?.('view-config', {
        view: 'dataview-chart',
      })
      expect(result).toMatchObject({ name: 'Chart', 'aynite-version': '0.1.8' })
    })

    it('returns null for unknown key', async () => {
      const result = await staticHandlers.get?.('unknown-key', undefined)
      expect(result).toBeNull()
    })

    it('returns empty array for matching-views when no filePath', async () => {
      const result = await staticHandlers.get?.('matching-views', {})
      expect(result).toEqual([])
    })
  })

  describe('set', () => {
    it('writes activeTheme to config', async () => {
      mockReadJson.mockResolvedValue({})
      const result = await staticHandlers.set?.('activeTheme', 'nord')
      expect(result).toBe(true)
      expect(mockWriteJson).toHaveBeenCalledWith(
        '/mock/.aynite/config/config.json',
        expect.objectContaining({ activeTheme: 'nord' }),
      )
    })

    it('writes language to config', async () => {
      mockReadJson.mockResolvedValue({})
      const result = await staticHandlers.set?.('language', 'zh')
      expect(result).toBe(true)
      expect(mockWriteJson).toHaveBeenCalledWith(
        '/mock/.aynite/config/config.json',
        expect.objectContaining({ language: 'zh' }),
      )
    })

    it('writes tools config', async () => {
      mockReadJson.mockResolvedValue({})
      const result = await staticHandlers.set?.('tools', {
        active: ['read_file'],
      })
      expect(result).toBe(true)
      expect(mockWriteJson).toHaveBeenCalledWith(
        '/mock/.aynite/config/config.json',
        expect.objectContaining({ aiTools: ['read_file'] }),
      )
    })

    it('returns false for unknown key', async () => {
      const result = await staticHandlers.set?.('unknown-key', {})
      expect(result).toBe(false)
    })
  })
})

// ─── Workspace State Handlers ───────────────────────────────────────────

describe('workspaceStateHandlers', () => {
  beforeEach(() => {
    mockGetWorkspacesList.mockResolvedValue({ active: 'Dev', list: ['Dev'] })
    mockGetWorkspaceState.mockResolvedValue({
      id: 'Dev',
      folders: ['/project'],
      files: [],
      activeFile: null,
      activeSessionId: null,
    })
  })

  describe('get', () => {
    it('returns activeFile from workspace state', async () => {
      mockGetWorkspaceState.mockResolvedValue({
        activeFile: '/project/src/main.ts',
      })
      const result = await workspaceStateHandlers.get?.('activeFile', undefined)
      expect(result).toBe('/project/src/main.ts')
    })

    it('returns null for activeFile when not set', async () => {
      mockGetWorkspaceState.mockResolvedValue({})
      const result = await workspaceStateHandlers.get?.('activeFile', undefined)
      expect(result).toBeNull()
    })

    it('returns openedFiles from workspace state', async () => {
      mockGetWorkspaceState.mockResolvedValue({
        files: ['/a.ts', '/b.ts'],
      })
      const result = await workspaceStateHandlers.get?.(
        'openedFiles',
        undefined,
      )
      expect(result).toEqual(['/a.ts', '/b.ts'])
    })

    it('returns empty array for openedFiles when not set', async () => {
      mockGetWorkspaceState.mockResolvedValue({})
      const result = await workspaceStateHandlers.get?.(
        'openedFiles',
        undefined,
      )
      expect(result).toEqual([])
    })

    it('returns activeSessionId from workspace state', async () => {
      mockGetWorkspaceState.mockResolvedValue({
        activeSessionId: 'session-abc',
      })
      const result = await workspaceStateHandlers.get?.(
        'activeSessionId',
        undefined,
      )
      expect(result).toBe('session-abc')
    })

    it('returns activeSessionId resolved via winId', async () => {
      mockGetWindowWorkspace.mockResolvedValue('OtherWs')
      mockGetWorkspaceState.mockResolvedValue({
        activeSessionId: 'session-xyz',
      })
      const result = await workspaceStateHandlers.get?.(
        'activeSessionId',
        undefined,
        2,
      )
      expect(result).toBe('session-xyz')
      expect(mockGetWindowWorkspace).toHaveBeenCalledWith(2)
    })

    it('returns chat logs from listSessions', async () => {
      const result = await workspaceStateHandlers.get?.('chatLogs', undefined)
      expect(result).toEqual([{ id: 'session-1', date: '2026-06-15' }])
    })

    it('returns merged system prompt', async () => {
      const result = await workspaceStateHandlers.get?.(
        'merged-system-prompt',
        {
          globalFiles: ['a.md'],
          agentFiles: ['b.md'],
        },
      )
      expect(result).toBe('merged-system-prompt')
    })

    it('returns null for unknown key', async () => {
      const result = await workspaceStateHandlers.get?.('unknown', undefined)
      expect(result).toBeNull()
    })
  })

  describe('set', () => {
    it('saves activeFile and adds to openedFiles when new', async () => {
      mockGetWorkspaceState.mockResolvedValue({
        id: 'Dev',
        files: ['/existing.ts'],
        activeFile: null,
      })

      const result = await workspaceStateHandlers.set?.('activeFile', '/new.ts')
      expect(result).toBe(true)
      expect(mockSaveWorkspaceState).toHaveBeenCalledWith('Dev', {
        activeFile: '/new.ts',
        files: ['/existing.ts', '/new.ts'],
      })
    })

    it('clears files when activeFile is set to null', async () => {
      mockGetWorkspaceState.mockResolvedValue({
        id: 'Dev',
        files: ['/a.ts'],
        activeFile: '/a.ts',
      })

      await workspaceStateHandlers.set?.('activeFile', null)
      expect(mockSaveWorkspaceState).toHaveBeenCalledWith('Dev', {
        activeFile: null,
        files: [],
      })
    })

    it('does not duplicate existing file in openedFiles', async () => {
      mockGetWorkspaceState.mockResolvedValue({
        id: 'Dev',
        files: ['/file.ts'],
        activeFile: null,
      })

      await workspaceStateHandlers.set?.('activeFile', '/file.ts')
      expect(mockSaveWorkspaceState).toHaveBeenCalledWith('Dev', {
        activeFile: '/file.ts',
        files: ['/file.ts'],
      })
    })

    it('saves chat log session', async () => {
      const result = await workspaceStateHandlers.set?.('save-chat-log', {
        id: 'session-1',
        messages: [{ role: 'user', content: 'hello' }],
      })
      expect(result).toBe(true)
    })

    it('sets activeSessionId and resolves workspace via winId', async () => {
      mockGetWindowWorkspace.mockResolvedValue('OtherWs')
      mockGetWorkspaceState.mockResolvedValue({})

      await workspaceStateHandlers.set?.('activeSessionId', 'session-abc', 2)
      expect(mockSaveWorkspaceState).toHaveBeenCalledWith('OtherWs', {
        activeSessionId: 'session-abc',
      })
    })

    it('updates tile data and broadcasts event', async () => {
      await workspaceStateHandlers.set?.(
        'tile-data',
        { tileId: 'tile-1', data: { file: '/readme.md' } },
        1,
      )
      expect(mockUpdateTileData).toHaveBeenCalledWith('tile-1', {
        file: '/readme.md',
      })
    })

    it('deletes session and broadcasts event', async () => {
      await workspaceStateHandlers.set?.('session-delete', 'session-old', 1)
    })

    it('returns false for unknown key', async () => {
      const result = await workspaceStateHandlers.set?.('unknown', {})
      expect(result).toBe(false)
    })
  })
})

// ─── AI Handlers ────────────────────────────────────────────────────────

describe('aiHandlers', () => {
  beforeEach(() => {
    mockGetWorkspacesList.mockResolvedValue({ active: 'Dev', list: ['Dev'] })
    mockGetWorkspaceState.mockResolvedValue({
      id: 'Dev',
      folders: [],
      files: [],
    })
  })

  describe('get', () => {
    it('returns ai config from loadConfig', async () => {
      const result = await aiHandlers.get?.('ai', undefined)
      expect(result).toEqual({
        activeId: 'test',
        providers: [],
      })
    })

    it('returns agents config with active workspace agentId', async () => {
      mockGetWorkspaceState.mockResolvedValue({
        activeAgentId: 'custom-agent',
      })
      const result = await aiHandlers.get?.('agents', undefined)
      expect(result).toMatchObject({
        activeId: 'custom-agent',
      })
    })

    it('returns agents config with fallback to main config', async () => {
      mockGetWorkspaceState.mockResolvedValue({})
      const result = await aiHandlers.get?.('agents', undefined)
      expect(result).toMatchObject({
        activeId: 'aynite',
        list: [{ id: 'aynite', name: 'Aynite' }],
      })
    })

    it('returns prompts config', async () => {
      const result = await aiHandlers.get?.('prompts', undefined)
      expect(result).toEqual({ files: ['global-prompt.md'] })
    })

    it('returns null for unknown key', async () => {
      const result = await aiHandlers.get?.('unknown', undefined)
      expect(result).toBeNull()
    })
  })

  describe('set', () => {
    it('writes AI config', async () => {
      mockReadJson.mockResolvedValue({ activeId: 'old', providers: [] })
      await aiHandlers.set?.('ai', { activeId: 'new-model' })
      expect(mockWriteJson).toHaveBeenCalledWith(
        '/mock/.aynite/config/ai.json',
        expect.objectContaining({ activeId: 'new-model' }),
      )
    })

    it('saves activeAgentId to workspace state', async () => {
      await aiHandlers.set?.('agents', { activeId: 'agent-2' })
      expect(mockSaveWorkspaceState).toHaveBeenCalledWith('Dev', {
        activeAgentId: 'agent-2',
      })
    })

    it('returns false for unknown key', async () => {
      const result = await aiHandlers.set?.('unknown', {})
      expect(result).toBe(false)
    })
  })
})

// ─── Config File Handlers ───────────────────────────────────────────────

describe('configFileHandlers', () => {
  describe('get', () => {
    it('returns keybindings from loadConfig', async () => {
      const result = await configFileHandlers.get?.('keybindings', undefined)
      expect(result).toEqual({ app: {}, view: {} })
    })

    it('returns tools with metadata and active map', async () => {
      const result = await configFileHandlers.get?.('tools', undefined)
      expect(result).toMatchObject({
        active: expect.objectContaining({ read_file: true }),
        list: expect.arrayContaining([
          expect.objectContaining({ name: 'read_file' }),
        ]),
      })
    })

    it('returns prompts config', async () => {
      const result = await configFileHandlers.get?.('prompts', undefined)
      expect(result).toEqual({ files: ['global-prompt.md'] })
    })

    it('returns skills config', async () => {
      const result = await configFileHandlers.get?.('skills', undefined)
      expect(result).toEqual({ folders: ['/mock/.aynite/skills'] })
    })

    it('returns null for unknown key', async () => {
      const result = await configFileHandlers.get?.('unknown', undefined)
      expect(result).toBeNull()
    })
  })

  describe('set', () => {
    it('writes keybindings', async () => {
      const payload = {
        app: { TILE_CYCLE: { ctrl: true, key: 'o' } },
        view: {},
      }
      await configFileHandlers.set?.('keybindings', payload)
      expect(mockWriteJson).toHaveBeenCalledWith(
        '/mock/.aynite/config/keybindings.json',
        payload,
      )
    })

    it('writes prompts to main config', async () => {
      mockReadJson.mockResolvedValue({})
      await configFileHandlers.set?.('prompts', { files: ['new-prompt.md'] })
      expect(mockWriteJson).toHaveBeenCalledWith(
        '/mock/.aynite/config/config.json',
        expect.objectContaining({ prompts: { files: ['new-prompt.md'] } }),
      )
    })

    it('writes skills to main config', async () => {
      mockReadJson.mockResolvedValue({})
      await configFileHandlers.set?.('skills', { folders: ['/custom/skills'] })
      expect(mockWriteJson).toHaveBeenCalledWith(
        '/mock/.aynite/config/config.json',
        expect.objectContaining({ skills: { folders: ['/custom/skills'] } }),
      )
    })

    it('writes AI config', async () => {
      mockReadJson.mockResolvedValue({ activeId: 'old', providers: [] })
      await configFileHandlers.set?.('ai', { activeId: 'new-model' })
      expect(mockWriteJson).toHaveBeenCalledWith(
        '/mock/.aynite/config/ai.json',
        expect.objectContaining({ activeId: 'new-model' }),
      )
    })

    it('returns false for unknown key', async () => {
      const result = await configFileHandlers.set?.('unknown', {})
      expect(result).toBe(false)
    })
  })
})

// ─── Telemetry Handlers ─────────────────────────────────────────────────

describe('telemetryHandlers', () => {
  describe('get', () => {
    it('returns telemetry config when present', async () => {
      mockReadJson.mockResolvedValue({
        telemetry: { enabled: true, clientId: 'abc-123' },
      })
      const result = await telemetryHandlers.get?.('telemetry', undefined)
      expect(result).toEqual({ enabled: true, clientId: 'abc-123' })
    })

    it('returns default disabled when telemetry missing', async () => {
      mockReadJson.mockResolvedValue({})
      const result = await telemetryHandlers.get?.('telemetry', undefined)
      expect(result).toEqual({ enabled: false })
    })
  })

  describe('set', () => {
    it('merges telemetry payload with existing config', async () => {
      mockReadJson.mockResolvedValue({
        telemetry: { enabled: true, clientId: 'abc' },
      })
      await telemetryHandlers.set?.('telemetry', { enabled: false })
      expect(mockWriteJson).toHaveBeenCalledWith(
        '/mock/.aynite/config/config.json',
        expect.objectContaining({
          telemetry: { enabled: false, clientId: 'abc' },
        }),
      )
    })

    it('creates telemetry config when none exists', async () => {
      mockReadJson.mockResolvedValue({})
      await telemetryHandlers.set?.('telemetry', { enabled: true })
      expect(mockWriteJson).toHaveBeenCalledWith(
        '/mock/.aynite/config/config.json',
        expect.objectContaining({
          telemetry: { enabled: true },
        }),
      )
    })
  })
})
