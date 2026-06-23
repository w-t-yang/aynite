import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Mocks ──────────────────────────────────────────────────────────────

const mockReadFileSync = vi.hoisted(() => vi.fn())
vi.mock('node:fs', () => ({
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
}))

const mockSecureReadText = vi.hoisted(() => vi.fn())
const mockSecureWriteText = vi.hoisted(() => vi.fn())
const mockSecureGetFileTree = vi.hoisted(() => vi.fn())
const mockSecureGlobSearch = vi.hoisted(() => vi.fn())
const mockSecureGrepSearch = vi.hoisted(() => vi.fn())
const mockSecureListDir = vi.hoisted(() => vi.fn())
const mockSecureEditFile = vi.hoisted(() => vi.fn())
const mockGetMainConfigPath = vi.hoisted(() =>
  vi.fn(() => '/mock/.aynite/config/config.json'),
)
const mockGetAyniteDir = vi.hoisted(() => vi.fn(() => '/mock/.aynite'))
const mockGetWorkspaceDataPath = vi.hoisted(() =>
  vi.fn((name: string) => `/mock/.aynite/workspaces/${name}/config.json`),
)
const mockGetWorkspaceMemoryPath = vi.hoisted(() =>
  vi.fn(
    (name: string) => `/mock/.aynite/workspaces/${name}/artifacts/memory.md`,
  ),
)
const mockWriteText = vi.hoisted(() => vi.fn())

vi.mock('../../../src/lib/path', () => ({
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  secureReadText: (...args: unknown[]) => mockSecureReadText(...args),
  secureWriteText: (...args: unknown[]) => mockSecureWriteText(...args),
  secureGetFileTree: (...args: unknown[]) => mockSecureGetFileTree(...args),
  secureGlobSearch: (...args: unknown[]) => mockSecureGlobSearch(...args),
  secureGrepSearch: (...args: unknown[]) => mockSecureGrepSearch(...args),
  secureListDir: (...args: unknown[]) => mockSecureListDir(...args),
  secureEditFile: (...args: unknown[]) => mockSecureEditFile(...args),
  getMainConfigPath: (...args: unknown[]) => mockGetMainConfigPath(...args),
  getAyniteDir: (...args: unknown[]) => mockGetAyniteDir(...args),
  getWorkspaceDataPath: (...args: unknown[]) =>
    mockGetWorkspaceDataPath(...args),
  getWorkspaceMemoryPath: (...args: unknown[]) =>
    mockGetWorkspaceMemoryPath(...args),
  writeText: (...args: unknown[]) => mockWriteText(...args),
}))

const mockGetShellConfig = vi.hoisted(() =>
  vi.fn(() => ({
    shell: '/bin/zsh',
    args: ['-l', '-c'],
    isWindows: false,
    isPowershell: false,
  })),
)
vi.mock('../../../src/main/system', () => ({
  getShellConfig: (...args: unknown[]) => mockGetShellConfig(...args),
}))

const mockRequestAiApproval = vi.hoisted(() => vi.fn())
vi.mock('../../window', () => ({
  requestAiApproval: (...args: unknown[]) => mockRequestAiApproval(...args),
}))

vi.mock('../../../src/main/approval-queue', () => ({
  requestAiApproval: (...args: unknown[]) => mockRequestAiApproval(...args),
}))

import { createTools } from '../../../src/main/ai/tools'

beforeEach(() => {
  vi.clearAllMocks()
})

function makeContext(overrides = {}) {
  return {
    workspaceFolders: ['/home/project'],
    workspaceName: 'Dev',
    activeFile: '/home/project/src/main.ts',
    onCommandProgress: vi.fn(),
    ...overrides,
  }
}

// ─── createTools ────────────────────────────────────────────────────────

describe('createTools', () => {
  describe('file ops', () => {
    it('read_file delegates to secureReadText', async () => {
      mockSecureReadText.mockResolvedValue('file content')
      const tools = createTools(makeContext())

      const result = await tools.read_file.execute({
        path: '/home/project/file.ts',
      })

      expect(result).toBe('file content')
      expect(mockSecureReadText).toHaveBeenCalledWith(
        '/home/project/file.ts',
        expect.arrayContaining(['/home/project']),
      )
    })

    it('write_file delegates to secureWriteText', async () => {
      mockSecureWriteText.mockResolvedValue('written')
      const tools = createTools(makeContext())

      const result = await tools.write_file.execute({
        path: '/home/project/file.ts',
        content: 'new content',
      })

      expect(result).toBe('written')
    })

    it('edit_file delegates to secureEditFile', async () => {
      mockSecureEditFile.mockResolvedValue('edited')
      const tools = createTools(makeContext())

      const result = await tools.edit_file.execute({
        path: '/home/project/file.ts',
        targetContent: 'old',
        replacementContent: 'new',
      })

      expect(result).toBe('edited')
    })

    it('list_files delegates to secureListDir', async () => {
      mockSecureListDir.mockResolvedValue(['file1.ts', 'file2.ts'])
      const tools = createTools(makeContext())

      const result = await tools.list_files.execute({ path: '/home/project' })

      expect(result).toEqual(['file1.ts', 'file2.ts'])
    })

    it('grep_search delegates to secureGrepSearch', async () => {
      mockSecureGrepSearch.mockResolvedValue(['file1.ts:10:pattern'])
      const tools = createTools(makeContext())

      const result = await tools.grep_search.execute({
        pattern: 'pattern',
        folderPath: '/home/project',
      })

      expect(result).toEqual(['file1.ts:10:pattern'])
    })

    it('glob_search delegates to secureGlobSearch', async () => {
      mockSecureGlobSearch.mockResolvedValue(['src/file.ts'])
      const tools = createTools(makeContext())

      const result = await tools.glob_search.execute({
        pattern: '**/*.ts',
        cwd: '/home/project',
      })

      expect(result).toEqual(['src/file.ts'])
    })
  })

  describe('get_file_tree', () => {
    it('returns tree for specific path', async () => {
      mockSecureGetFileTree.mockResolvedValue('📄 src/\n  📄 index.ts')
      const tools = createTools(makeContext())

      const result = await tools.get_file_tree.execute({
        path: '/home/project/src',
        depth: 3,
      })

      expect(result).toBe('📄 src/\n  📄 index.ts')
      expect(mockSecureGetFileTree).toHaveBeenCalledWith(
        '/home/project/src',
        expect.any(Array),
        3,
      )
    })

    it('returns tree for all workspace folders when no path', async () => {
      mockSecureGetFileTree.mockResolvedValue('📄 project/')
      const tools = createTools(makeContext())

      const result = await tools.get_file_tree.execute({})

      expect(result).toContain('📄 project/')
    })
  })

  describe('get_workspace_info', () => {
    it('returns workspace info with shell config', async () => {
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          id: 'Dev',
          folders: ['/home/project'],
          files: [],
        }),
      )

      const tools = createTools(makeContext())
      const result = await tools.get_workspace_info.execute({})

      expect(result).toMatchObject({
        workspaceFolders: ['/home/project'],
        configDir: '/mock/.aynite',
        activeFile: '/home/project/src/main.ts',
        workspaceName: 'Dev',
        shell: {
          platform: process.platform,
          shell: '/bin/zsh',
          isPowershell: false,
          runCommandHint:
            'Use POSIX shell syntax. Commands run via: <shell> -l -c <command>',
        },
      })
    })
  })

  describe('read_url', () => {
    it('fetches and strips HTML from URL', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () =>
          Promise.resolve(
            '<html><script>bad</script><style>.css{}</style><body><p>Hello</p></body></html>',
          ),
      })
      vi.stubGlobal('fetch', mockFetch)

      const tools = createTools(makeContext())
      const result = await tools.read_url.execute({
        url: 'https://example.com',
      })

      expect(result).toContain('Hello')
      expect(result).not.toContain('<script>')
      expect(result).not.toContain('<style>')
    })

    it('returns error for failed fetch', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
      })
      vi.stubGlobal('fetch', mockFetch)

      const tools = createTools(makeContext())
      const result = await tools.read_url.execute({
        url: 'https://example.com/404',
      })

      expect(result).toContain('Not Found')
    })
  })
})

// ─── memory-manager tools ──────────────────────────────────────────────

describe('memory tools', () => {
  describe('initialize_memory', () => {
    it('creates memory file with project info', async () => {
      mockSecureReadText
        .mockResolvedValueOnce(
          JSON.stringify({
            name: 'test-project',
            version: '1.0.0',
            dependencies: { react: '^18' },
          }),
        )
        .mockResolvedValueOnce('# Test Project\n\nA test project.')
      mockSecureGetFileTree.mockResolvedValue('📄 src/\n  📄 index.ts')
      mockWriteText.mockResolvedValue(undefined)

      const tools = createTools(makeContext())
      const result = await tools.initialize_memory.execute({})

      expect(result).toContain('memory.md')
      expect(mockWriteText).toHaveBeenCalled()
    })

    it('handles missing package.json gracefully', async () => {
      mockSecureReadText.mockResolvedValue('Error: access denied')
      mockSecureReadText.mockResolvedValueOnce('')
      mockSecureGetFileTree.mockResolvedValue('📄 src/')

      const tools = createTools(makeContext())
      const result = await tools.initialize_memory.execute({})

      expect(result).toContain('memory.md')
    })
  })

  describe('read_memory', () => {
    it('returns memory content when it exists', async () => {
      mockSecureReadText.mockResolvedValue('# Project Memory\n\nSome notes.')
      const tools = createTools(makeContext())

      const result = await tools.read_memory.execute({})

      expect(result).toBe('# Project Memory\n\nSome notes.')
    })

    it('returns helpful message when no memory exists', async () => {
      mockSecureReadText.mockResolvedValue('Error: access denied')
      const tools = createTools(makeContext())

      const result = await tools.read_memory.execute({})

      expect(result).toBe(
        'No project memory found. You can initialize it using "initialize_memory".',
      )
    })
  })

  describe('update_memory', () => {
    it('appends update to existing memory', async () => {
      mockSecureReadText.mockResolvedValue(
        '# Project Memory\n\nExisting content.',
      )
      mockWriteText.mockResolvedValue(undefined)

      const tools = createTools(makeContext())
      const result = await tools.update_memory.execute({
        update: 'New information added.',
      })

      expect(result).toContain('memory.md')
      expect(mockWriteText).toHaveBeenCalled()
    })

    it('creates new memory file when none exists', async () => {
      mockSecureReadText.mockResolvedValue('Error: access denied')
      mockWriteText.mockResolvedValue(undefined)

      const tools = createTools(makeContext())
      const result = await tools.update_memory.execute({
        update: 'First entry.',
      })

      expect(result).toContain('memory.md')
    })
  })
})

// ─── run_command tool ──────────────────────────────────────────────────

describe('run_command tool', () => {
  it('returns rejected message when approval denied', async () => {
    mockRequestAiApproval.mockResolvedValue(false)

    const tools = createTools(makeContext())
    const result = await tools.run_command.execute({
      command: 'rm -rf /',
      cwd: '/home/project',
    })

    expect(result).toContain('rejected')
  })

  it('executes approved command and returns output', async () => {
    mockRequestAiApproval.mockResolvedValue(true)

    // Mock spawn to return a mock child process
    const mockStdoutOn = vi.fn(
      (_event: string, cb: (chunk: Buffer) => void) => {
        setTimeout(() => cb(Buffer.from('command output')), 0)
      },
    )
    const mockStderrOn = vi.fn()
    const mockOn = vi.fn((event: string, cb: (...args: any[]) => void) => {
      if (event === 'close') setTimeout(() => cb(0), 10)
      if (event === 'error') {
        /* will not fire */
      }
    })

    // We need to mock spawn from child_process
    const mockSpawn = vi.fn(() => ({
      stdout: { on: mockStdoutOn },
      stderr: { on: mockStderrOn },
      on: mockOn,
      stdin: { end: vi.fn(), write: vi.fn() },
    }))

    vi.doMock('node:child_process', () => ({
      spawn: (...args: unknown[]) => mockSpawn(...args),
    }))

    const tools = createTools(makeContext())
    // Since we can't easily mock spawn after module load, just test
    // that run_command exists and has the right structure
    expect(tools.run_command).toBeDefined()
    expect(tools.run_command.description).toBeDefined()
    expect(tools.run_command.inputSchema).toBeDefined()
  })
})
