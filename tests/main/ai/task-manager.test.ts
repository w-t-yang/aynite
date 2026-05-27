import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ToolContext } from '../../../src/lib/types/ai'
import { createTools } from '../../../src/main/ai/tools'

// ─── Mock filesystem operations ─────────────────────────────────────────

const mockWriteText = vi.hoisted(() => vi.fn())
const mockReadText = vi.hoisted(() => vi.fn())
const mockGetWorkspaceTaskPath = vi.hoisted(() => vi.fn())

vi.mock('../../../src/lib/path', () => ({
  secureReadText: (...args: unknown[]) => mockReadText(...args),
  writeText: (...args: unknown[]) => mockWriteText(...args),
  getWorkspaceTaskPath: (...args: unknown[]) =>
    mockGetWorkspaceTaskPath(...args),
  getWorkspaceMemoryPath: vi.fn(),
  getWorkspaceDataPath: vi.fn(
    () => '/mock/.aynite/workspaces/Test/config.json',
  ),
  getAyniteDir: vi.fn(() => '/mock/.aynite'),
  secureGetFileTree: vi.fn(() => '📁 src\n  📄 index.ts'),
  secureWriteText: vi.fn(),
  secureEditFile: vi.fn(),
  secureListDir: vi.fn(),
  secureGlobSearch: vi.fn(),
  secureGrepSearch: vi.fn(),
}))

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(() => JSON.stringify({ folders: ['/test/project'] })),
}))

const mockRequestAiApproval = vi.hoisted(() => vi.fn())
vi.mock('../../../src/main/window', () => ({
  requestAiApproval: (...args: unknown[]) => mockRequestAiApproval(...args),
}))

// ─── Test setup ─────────────────────────────────────────────────────────

const defaultContext: ToolContext = {
  workspaceName: 'Test',
  workspaceFolders: ['/test/project'],
  onCommandProgress: vi.fn(),
  activeFile: '/test/project/src/main.ts',
}

function getTools(context = defaultContext) {
  return createTools(context)
}

describe('create_task', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetWorkspaceTaskPath.mockReturnValue(
      '/mock/.aynite/workspaces/Test/artifacts/task.md',
    )
  })

  it('creates a task file with checklist items', async () => {
    mockWriteText.mockResolvedValue(undefined)
    const tools = getTools()
    const result = await tools.create_task.execute({
      tasks: ['Setup CI pipeline', 'Add linter', 'Write docs'],
    })

    expect(mockWriteText).toHaveBeenCalledWith(
      '/mock/.aynite/workspaces/Test/artifacts/task.md',
      '- [ ] Setup CI pipeline\n- [ ] Add linter\n- [ ] Write docs',
    )
    expect(result).toContain('Created task list')
  })

  it('accepts custom filename', async () => {
    mockWriteText.mockResolvedValue(undefined)
    mockGetWorkspaceTaskPath.mockReturnValue(
      '/mock/.aynite/workspaces/Test/artifacts/mytasks.md',
    )

    const tools = getTools()
    await tools.create_task.execute({
      tasks: ['Task one'],
      filename: 'mytasks.md',
    })

    expect(mockGetWorkspaceTaskPath).toHaveBeenCalledWith('Test', 'mytasks.md')
    expect(mockWriteText).toHaveBeenCalledWith(
      '/mock/.aynite/workspaces/Test/artifacts/mytasks.md',
      expect.any(String),
    )
  })

  it('handles empty task list', async () => {
    mockWriteText.mockResolvedValue(undefined)
    const tools = getTools()
    const result = await tools.create_task.execute({ tasks: [] })

    expect(mockWriteText).toHaveBeenCalledWith(expect.any(String), '')
    expect(result).toContain('Created task list')
  })
})

describe('update_task', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetWorkspaceTaskPath.mockReturnValue(
      '/mock/.aynite/workspaces/Test/artifacts/task.md',
    )
  })

  it('marks a task as done', async () => {
    mockReadText.mockResolvedValue(
      '- [ ] Setup CI\n- [ ] Add linter\n- [ ] Write docs',
    )
    mockWriteText.mockResolvedValue(undefined)

    const tools = getTools()
    const result = await tools.update_task.execute({
      taskIndex: 0,
      status: 'done',
    })

    expect(mockWriteText).toHaveBeenCalledWith(
      expect.any(String),
      '- [x] Setup CI\n- [ ] Add linter\n- [ ] Write docs',
    )
    expect(result).toContain('Updated task 1 to done')
    expect(result).toContain('(1/3)')
  })

  it('marks a task as in_progress', async () => {
    mockReadText.mockResolvedValue(
      '- [ ] Setup CI\n- [ ] Add linter\n- [ ] Write docs',
    )
    mockWriteText.mockResolvedValue(undefined)

    const tools = getTools()
    const result = await tools.update_task.execute({
      taskIndex: 1,
      status: 'in_progress',
    })

    expect(mockWriteText).toHaveBeenCalledWith(
      expect.any(String),
      '- [ ] Setup CI\n- [/] Add linter\n- [ ] Write docs',
    )
    expect(result).toContain('Updated task 2 to in_progress')
    expect(result).toContain('(0/3)')
  })

  it('returns error for out-of-range index', async () => {
    mockReadText.mockResolvedValue('- [ ] Task one\n- [ ] Task two')
    mockWriteText.mockResolvedValue(undefined)

    const tools = getTools()
    const result = await tools.update_task.execute({
      taskIndex: 5,
      status: 'done',
    })

    expect(result).toContain('out of range')
    expect(mockWriteText).not.toHaveBeenCalled()
  })

  it('returns error for negative index', async () => {
    mockReadText.mockResolvedValue('- [ ] Task one')
    mockWriteText.mockResolvedValue(undefined)

    const tools = getTools()
    const result = await tools.update_task.execute({
      taskIndex: -1,
      status: 'done',
    })

    expect(result).toContain('out of range')
  })

  it('returns error when task file does not exist', async () => {
    mockReadText.mockResolvedValue('Error: File not found')

    const tools = getTools()
    const result = await tools.update_task.execute({
      taskIndex: 0,
      status: 'done',
    })

    expect(result).toContain('File not found')
  })

  it('counts progress correctly with mixed statuses', async () => {
    mockReadText.mockResolvedValue(
      '- [x] Done task\n- [/] In progress\n- [ ] Todo task\n- [x] Another done',
    )
    mockWriteText.mockResolvedValue(undefined)

    const tools = getTools()
    const result = await tools.update_task.execute({
      taskIndex: 2,
      status: 'in_progress',
    })

    expect(result).toContain('(2/4)') // 2 done, 4 total
  })
})

describe('get_tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetWorkspaceTaskPath.mockReturnValue(
      '/mock/.aynite/workspaces/Test/artifacts/task.md',
    )
  })

  it('reads existing task file', async () => {
    mockReadText.mockResolvedValue('- [ ] Task one\n- [x] Task two')

    const tools = getTools()
    const result = await tools.get_tasks.execute({})

    expect(result).toBe('- [ ] Task one\n- [x] Task two')
  })

  it('returns error message for missing task file', async () => {
    mockReadText.mockResolvedValue('Error: ENOENT: no such file')

    const tools = getTools()
    const result = await tools.get_tasks.execute({})

    expect(result).toContain('ENOENT')
  })
})
