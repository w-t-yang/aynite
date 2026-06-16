import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Mocks: system boundaries ───────────────────────────────────────────

const mockGetVersion = vi.fn(() => '1.0.0-test')

vi.mock('electron', () => ({
  app: {
    getVersion: () => mockGetVersion(),
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
const mockGetWorkspaceDataPath = vi.hoisted(() =>
  vi.fn((name: string) => `/mock/.aynite/workspaces/${name}/config.json`),
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
  getAIConfigPath: vi.fn(() => '/mock/.aynite/config/ai.json'),
  getWorkspaceDataPath: (...args: unknown[]) =>
    mockGetWorkspaceDataPath(...args),
  AYNITE_SUBDIRS: { VIEWS: 'views', CONFIG: 'config' },
  expandHome: vi.fn((p: string) => p),
  getAbsolutePath: vi.fn((p: string) => p),
  joinPaths: vi.fn((...parts: string[]) => parts.join('/')),
  getDirname: vi.fn((p: string) => p.split('/').slice(0, -1).join('/')),
  getRelativePath: vi.fn((from: string, to: string) =>
    to.replace(`${from}/`, ''),
  ),
}))

// Mock domain module dependencies
vi.mock('../../../src/main/ai', () => ({
  getMergedSystemPrompt: vi.fn(() => 'merged-system-prompt'),
  getToolsMetadata: vi.fn(() => [
    {
      name: 'read_file',
      description: 'Read a file',
      inputSchema: { type: 'object' },
    },
  ]),
  listSessions: vi.fn(() => []),
  loadSession: vi.fn(() => null),
  saveSession: vi.fn(),
  deleteSession: vi.fn(),
}))

vi.mock('../../../src/main/theme', () => ({
  getThemesList: vi.fn(() => ['light', 'dark', 'nord']),
  getTheme: vi.fn((id: string) => ({ id, name: id })),
  saveTheme: vi.fn(),
  deleteTheme: vi.fn(() => true),
}))

const mockGetWorkspaceState = vi.hoisted(() => vi.fn())
const mockGetWorkspacesList = vi.hoisted(() => vi.fn())
const mockSaveWorkspaceState = vi.hoisted(() => vi.fn())
const mockSwitchWorkspace = vi.hoisted(() => vi.fn())

vi.mock('../../../src/main/workspace', () => ({
  getWorkspacesList: (...args: unknown[]) => mockGetWorkspacesList(...args),
  getWorkspaceState: (...args: unknown[]) => mockGetWorkspaceState(...args),
  saveWorkspaceState: (...args: unknown[]) => mockSaveWorkspaceState(...args),
  switchWorkspace: (...args: unknown[]) => mockSwitchWorkspace(...args),
  updateTileData: vi.fn(),
}))

vi.mock('../../../src/main/window', () => ({
  sendToWindow: vi.fn(),
}))

const mockGetWindowWorkspace = vi.hoisted(() => vi.fn(() => 'MockWorkspace'))
const mockSetWindowWorkspace = vi.hoisted(() => vi.fn())

vi.mock('../../../src/main/window-state', () => ({
  getWindowWorkspace: (...args: unknown[]) => mockGetWindowWorkspace(...args),
  setWindowWorkspace: (...args: unknown[]) => mockSetWindowWorkspace(...args),
}))

vi.mock('../../../src/main/config/logic', () => ({
  loadConfig: vi.fn(() => ({
    keybindings: { app: { TILE_CYCLE: { ctrl: true, key: 'o' } }, view: {} },
    ai: { activeId: 'test', providers: [] },
    agents: { activeId: 'aynite', list: [{ id: 'aynite', name: 'Aynite' }] },
    prompts: { files: [] },
    skills: { folders: [] },
    commands: { folders: [] },
  })),
}))

vi.mock('../../../src/main/config/schema-validator', () => ({
  validateAgainstSchema: vi.fn(() => true),
}))

import { routeGetConfig, routeSetConfig } from '../../../src/main/config/router'

describe('routeGetConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('pure handlers (no side-effect mocks needed)', () => {
    it('returns app version for VERSION key', async () => {
      const result = await routeGetConfig('version')
      expect(result).toBe('1.0.0-test')
    })

    it('returns playbook path for PLAYBOOK_PATH key', async () => {
      const result = await routeGetConfig('playbook-path')
      expect(result).toBe('/mock/.aynite/aynite-playbook')
    })

    it('returns active theme from config for ACTIVE_THEME key', async () => {
      mockReadJson.mockResolvedValue({ activeTheme: 'nord' })
      const result = await routeGetConfig('activeTheme')
      expect(result).toBe('nord')
    })

    it('returns "light" as default theme when config missing', async () => {
      mockReadJson.mockResolvedValue({})
      const result = await routeGetConfig('activeTheme')
      expect(result).toBe('light')
    })

    it('returns view config for VIEW_CONFIG key', async () => {
      mockReadJson.mockResolvedValue({
        name: 'Chart',
        description: 'Chart view',
        'aynite-version': '1.0.0-test',
      })
      const result = await routeGetConfig('view-config', {
        view: 'dataview-chart',
      })
      expect(result).toMatchObject({ name: 'Chart' })
    })

    it('returns null for VIEW_CONFIG when no view name provided', async () => {
      const result = await routeGetConfig('view-config', {})
      expect(result).toBeNull()
    })

    it('returns null for unknown key', async () => {
      const result = await routeGetConfig('non-existent-key')
      expect(result).toBeNull()
    })
  })

  describe('workspace-scoped keys', () => {
    it('returns activeFile from workspace state', async () => {
      mockGetWorkspacesList.mockResolvedValue({ active: 'Dev', list: ['Dev'] })
      mockGetWorkspaceState.mockResolvedValue({
        activeFile: '/repo/src/main.ts',
      })
      const result = await routeGetConfig('activeFile')
      expect(result).toBe('/repo/src/main.ts')
    })

    it('returns null for activeFile when not set', async () => {
      mockGetWorkspacesList.mockResolvedValue({ active: 'Dev', list: ['Dev'] })
      mockGetWorkspaceState.mockResolvedValue({})
      const result = await routeGetConfig('activeFile')
      expect(result).toBeNull()
    })

    it('returns openedFiles from workspace state', async () => {
      mockGetWorkspacesList.mockResolvedValue({ active: 'Dev', list: ['Dev'] })
      mockGetWorkspaceState.mockResolvedValue({
        files: ['/repo/a.ts', '/repo/b.ts'],
      })
      const result = await routeGetConfig('openedFiles')
      expect(result).toEqual(['/repo/a.ts', '/repo/b.ts'])
    })

    it('returns empty array for openedFiles when not set', async () => {
      mockGetWorkspacesList.mockResolvedValue({ active: 'Dev', list: ['Dev'] })
      mockGetWorkspaceState.mockResolvedValue({})
      const result = await routeGetConfig('openedFiles')
      expect(result).toEqual([])
    })

    it('returns activeSessionId from workspace state', async () => {
      mockGetWorkspacesList.mockResolvedValue({ active: 'Dev', list: ['Dev'] })
      mockGetWorkspaceState.mockResolvedValue({
        activeSessionId: 'session-123',
      })
      const result = await routeGetConfig('activeSessionId')
      expect(result).toBe('session-123')
    })

    it('returns activeSessionId from workspace resolved via winId', async () => {
      mockGetWindowWorkspace.mockResolvedValue('Dev')
      mockGetWorkspaceState.mockResolvedValue({
        activeSessionId: 'session-456',
      })
      const result = await routeGetConfig('activeSessionId', undefined, 1)
      expect(result).toBe('session-456')
      expect(mockGetWindowWorkspace).toHaveBeenCalledWith(1)
    })

    it('returns workspaces configs list', async () => {
      mockGetWorkspacesList.mockResolvedValue({
        active: 'Dev',
        list: ['Dev', 'Playbook'],
      })
      mockGetWorkspaceState
        .mockResolvedValueOnce({ id: 'Dev', folders: ['/dev'] })
        .mockResolvedValueOnce({ id: 'Playbook', folders: ['/playbook'] })
      const result = await routeGetConfig('workspaces')
      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('Dev')
      expect(result[1].id).toBe('Playbook')
    })
  })
})

// ─── routeSetConfig ────────────────────────────────────────────────────

describe('routeSetConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('simple keys', () => {
    it('writes keybindings config', async () => {
      const payload = {
        app: { TILE_CYCLE: { ctrl: true, key: 'o' } },
        view: {},
      }
      const result = await routeSetConfig('keybindings', payload)
      expect(result).toBe(true)
      expect(mockWriteJson).toHaveBeenCalledWith(
        '/mock/.aynite/config/keybindings.json',
        payload,
      )
    })

    it('sets active theme', async () => {
      mockReadJson.mockResolvedValue({})
      const result = await routeSetConfig('activeTheme', 'nord')
      expect(result).toBe(true)
      expect(mockWriteJson).toHaveBeenCalledWith(
        '/mock/.aynite/config/config.json',
        expect.objectContaining({ activeTheme: 'nord' }),
      )
    })

    it('returns false for unknown key', async () => {
      const result = await routeSetConfig('non-existent-key', {})
      expect(result).toBe(false)
    })
  })

  describe('atomic ACTIVE_FILE update', () => {
    it('sets activeFile and adds to openedFiles when file is new', async () => {
      // First call: loadConfig -> workspaces list
      // Second call: getWorkspaceState
      mockGetWorkspacesList.mockResolvedValue({ active: 'Dev', list: ['Dev'] })
      mockGetWorkspaceState.mockResolvedValue({
        id: 'Dev',
        files: ['/repo/other.ts'],
        activeFile: '/repo/other.ts',
      })

      const result = await routeSetConfig('activeFile', '/repo/new.ts')

      expect(result).toBe(true)
      expect(mockSaveWorkspaceState).toHaveBeenCalledWith('Dev', {
        activeFile: '/repo/new.ts',
        files: ['/repo/other.ts', '/repo/new.ts'],
      })
    })

    it('sets activeFile to null and clears openedFiles', async () => {
      mockGetWorkspacesList.mockResolvedValue({ active: 'Dev', list: ['Dev'] })
      mockGetWorkspaceState.mockResolvedValue({
        id: 'Dev',
        files: ['/repo/a.ts'],
        activeFile: '/repo/a.ts',
      })

      const result = await routeSetConfig('activeFile', null)

      expect(result).toBe(true)
      expect(mockSaveWorkspaceState).toHaveBeenCalledWith('Dev', {
        activeFile: null,
        files: [],
      })
    })

    it('does not duplicate existing file in openedFiles', async () => {
      mockGetWorkspacesList.mockResolvedValue({ active: 'Dev', list: ['Dev'] })
      mockGetWorkspaceState.mockResolvedValue({
        id: 'Dev',
        files: ['/repo/file.ts'],
        activeFile: null,
      })

      await routeSetConfig('activeFile', '/repo/file.ts')

      expect(mockSaveWorkspaceState).toHaveBeenCalledWith('Dev', {
        activeFile: '/repo/file.ts',
        files: ['/repo/file.ts'],
      })
    })
  })

  describe('activeWorkspace switching', () => {
    it('switches workspace and updates window state', async () => {
      mockGetWorkspacesList.mockResolvedValue({
        active: 'Dev',
        list: ['Dev', 'Playbook'],
      })
      mockSwitchWorkspace.mockResolvedValue({
        active: 'Playbook',
        list: ['Dev', 'Playbook'],
      })

      const result = await routeSetConfig('activeWorkspace', 'Playbook', 1)

      expect(result).toBe(true)
      expect(mockSwitchWorkspace).toHaveBeenCalledWith('Playbook')
      expect(mockSetWindowWorkspace).toHaveBeenCalledWith(1, 'Playbook')
    })
  })
})
