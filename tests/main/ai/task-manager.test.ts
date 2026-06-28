import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ToolContext } from '../../../src/lib/types/ai'
import { createTools } from '../../../src/main/ai/tools'

// ─── Mock filesystem operations ─────────────────────────────────────────

const mockWriteText = vi.hoisted(() => vi.fn())
const mockReadText = vi.hoisted(() => vi.fn())
const mockReadJson = vi.hoisted(() => vi.fn())
const mockWriteJson = vi.hoisted(() => vi.fn())
const mockRename = vi.hoisted(() => vi.fn())

vi.mock('../../../src/lib/path', () => ({
  secureReadText: (...args: unknown[]) => mockReadText(...args),
  writeText: (...args: unknown[]) => mockWriteText(...args),
  readJson: (...args: unknown[]) => mockReadJson(...args),
  writeJson: (...args: unknown[]) => mockWriteJson(...args),
  rename: (...args: unknown[]) => mockRename(...args),
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

vi.mock('../../../src/main/approval-queue', () => ({
  requestAiApproval: (...args: unknown[]) => mockRequestAiApproval(...args),
}))

// ─── Test setup ─────────────────────────────────────────────────────────

const SESSION_DIR = '/mock/.aynite/workspaces/Test/sessions/test-123'
const META_PATH = `${SESSION_DIR}/metadata.json`

const defaultContext: ToolContext = {
  workspaceName: 'Test',
  workspaceFolders: ['/test/project'],
  onCommandProgress: vi.fn(),
  activeFile: '/test/project/src/main.ts',
  sessionDir: SESSION_DIR,
}

function getTools(context = defaultContext) {
  return createTools(context)
}

// Helper: mock that metadata exists with a currentTaskFile
function mockMeta(taskFile?: string, planFile?: string) {
  mockReadJson.mockResolvedValue({
    agentName: 'Test',
    modelName: 'test-model',
    type: 'general',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    currentTaskFile: taskFile,
    currentPlanFile: planFile,
  })
}

describe('create_task', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a task file with checklist items and saves to metadata', async () => {
    mockWriteText.mockResolvedValue(undefined)
    mockReadJson.mockRejectedValue(new Error('no metadata')) // first read fails
    mockWriteJson.mockResolvedValue(undefined)

    const tools = getTools()
    const result = await tools.create_task.execute({
      tasks: ['Setup CI pipeline', 'Add linter', 'Write docs'],
    })

    // Should write task file
    expect(mockWriteText).toHaveBeenCalledWith(
      expect.stringContaining(`${SESSION_DIR}/tasks-`),
      '- [ ] Setup CI pipeline\n- [ ] Add linter\n- [ ] Write docs',
    )
    // Should save metadata with the filename
    expect(mockWriteJson).toHaveBeenCalledWith(
      META_PATH,
      expect.objectContaining({
        currentTaskFile: expect.stringMatching(/^tasks-\d+\.md$/),
      }),
    )
    expect(result).toContain('Created task list')
  })

  it('handles empty task list', async () => {
    mockWriteText.mockResolvedValue(undefined)
    mockReadJson.mockRejectedValue(new Error('no metadata'))
    mockWriteJson.mockResolvedValue(undefined)

    const tools = getTools()
    const result = await tools.create_task.execute({ tasks: [] })

    expect(mockWriteText).toHaveBeenCalled()
    expect(result).toContain('Created task list')
  })
})

describe('update_task', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('marks a task as done', async () => {
    mockMeta('tasks-111.md')
    mockReadText.mockResolvedValue(
      '- [ ] Setup CI\n- [ ] Add linter\n- [ ] Write docs',
    )
    mockWriteText.mockResolvedValue(undefined)
    mockWriteJson.mockResolvedValue(undefined)

    const tools = getTools()
    const result = await tools.update_task.execute({
      taskIndex: 0,
      status: 'done',
    })

    expect(mockWriteText).toHaveBeenCalledWith(
      `${SESSION_DIR}/tasks-111.md`,
      '- [x] Setup CI\n- [ ] Add linter\n- [ ] Write docs',
    )
    expect(result).toContain('Updated task 1 to done')
    expect(result).toContain('(1/3)')
  })

  it('returns error when no active task list', async () => {
    mockReadJson.mockResolvedValue({}) // no currentTaskFile

    const tools = getTools()
    const result = await tools.update_task.execute({
      taskIndex: 0,
      status: 'done',
    })

    expect(result).toBe(
      'No active task list. Create one with `create_task` first.',
    )
  })

  it('returns error for out-of-range index', async () => {
    mockMeta('tasks-111.md')
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

  it('counts progress correctly with mixed statuses', async () => {
    mockMeta('tasks-111.md')
    mockReadText.mockResolvedValue(
      '- [x] Done task\n- [/] In progress\n- [ ] Todo task\n- [x] Another done',
    )
    mockWriteText.mockResolvedValue(undefined)

    const tools = getTools()
    const result = await tools.update_task.execute({
      taskIndex: 2,
      status: 'in_progress',
    })

    expect(result).toContain('(2/4)')
  })

  it('renames task and plan files when all tasks done', async () => {
    mockMeta('tasks-111.md', 'plan-111.md')
    mockReadText.mockResolvedValue('- [x] All done')
    mockWriteText.mockResolvedValue(undefined)
    mockWriteJson.mockResolvedValue(undefined)
    mockRename.mockResolvedValue(undefined)

    const tools = getTools()
    const result = await tools.update_task.execute({
      taskIndex: 0,
      status: 'done',
    })

    // Should rename task file to done
    expect(mockRename).toHaveBeenCalledWith(
      `${SESSION_DIR}/tasks-111.md`,
      `${SESSION_DIR}/tasks-111-done.md`,
    )
    // Should rename plan file to done
    expect(mockRename).toHaveBeenCalledWith(
      `${SESSION_DIR}/plan-111.md`,
      `${SESSION_DIR}/plan-111-done.md`,
    )
    expect(result).toContain('All tasks completed!')
  })

  it('handles read error gracefully in catch block', async () => {
    mockMeta('tasks-111.md')
    mockReadText.mockRejectedValue(new Error('Disk failure'))

    const tools = getTools()
    const result = await tools.update_task.execute({
      taskIndex: 0,
      status: 'done',
    })

    expect(result).toContain('Error updating task')
    expect(result).toContain('Disk failure')
  })

  it('all-done without plan file does not rename plan', async () => {
    mockMeta('tasks-111.md') // no planFile
    mockReadText.mockResolvedValue('- [x] Only task')
    mockWriteText.mockResolvedValue(undefined)
    mockWriteJson.mockResolvedValue(undefined)
    mockRename.mockResolvedValue(undefined)

    const tools = getTools()
    const result = await tools.update_task.execute({
      taskIndex: 0,
      status: 'done',
    })

    expect(mockRename).toHaveBeenCalledWith(
      `${SESSION_DIR}/tasks-111.md`,
      `${SESSION_DIR}/tasks-111-done.md`,
    )
    // Should NOT rename a plan file (none existed)
    expect(mockRename).not.toHaveBeenCalledWith(
      expect.stringContaining('plan-'),
      expect.any(String),
    )
    expect(result).toContain('All tasks completed!')
  })

  it('returns error when secureReadText returns error string', async () => {
    mockMeta('tasks-111.md')
    mockReadText.mockResolvedValue('Error: Access denied by security policy')

    const tools = getTools()
    const result = await tools.update_task.execute({
      taskIndex: 0,
      status: 'done',
    })

    expect(result).toBe('Error: Access denied by security policy')
  })
})

describe('get_tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reads task file from metadata', async () => {
    mockMeta('tasks-111.md')
    mockReadText.mockResolvedValue('- [ ] Task one\n- [x] Task two')

    const tools = getTools()
    const result = await tools.get_tasks.execute({})

    expect(mockReadText).toHaveBeenCalledWith(
      `${SESSION_DIR}/tasks-111.md`,
      expect.any(Array),
    )
    expect(result).toBe('- [ ] Task one\n- [x] Task two')
  })

  it('returns message when no active task list', async () => {
    mockReadJson.mockResolvedValue({})

    const tools = getTools()
    const result = await tools.get_tasks.execute({})

    expect(result).toBe(
      'No active task list. Create one with `create_task` first.',
    )
  })
})

describe('propose_plan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a plan file and saves to metadata', async () => {
    mockWriteText.mockResolvedValue(undefined)
    mockReadJson.mockRejectedValue(new Error('no metadata'))
    mockWriteJson.mockResolvedValue(undefined)

    const tools = getTools()
    const result = await tools.propose_plan.execute({
      problemStatement: 'Test problem',
      investigationResults: 'Test results',
      proposedArchitecture: 'Test architecture',
      implementationSteps: ['Step 1', 'Step 2'],
      verificationPlan: 'Test verification',
    })

    expect(mockWriteText).toHaveBeenCalledWith(
      expect.stringContaining(`${SESSION_DIR}/plan-`),
      expect.stringContaining('# Implementation Plan'),
    )
    expect(mockWriteJson).toHaveBeenCalledWith(
      META_PATH,
      expect.objectContaining({
        currentPlanFile: expect.stringMatching(/^plan-\d+\.md$/),
      }),
    )
    expect(result).toContain('Implementation plan proposed')
  })

  it('includes open questions when provided', async () => {
    mockWriteText.mockResolvedValue(undefined)
    mockReadJson.mockRejectedValue(new Error('no metadata'))
    mockWriteJson.mockResolvedValue(undefined)

    const tools = getTools()
    const result = await tools.propose_plan.execute({
      problemStatement: 'Test',
      investigationResults: 'Results',
      proposedArchitecture: 'Arch',
      implementationSteps: ['Step 1'],
      verificationPlan: 'Verify',
      openQuestions: ['Is this right?', 'Any alternatives?'],
    })

    const writtenContent = mockWriteText.mock.calls[0][1]
    expect(writtenContent).toContain('Is this right?')
    expect(writtenContent).toContain('Any alternatives?')
    expect(result).toContain('Implementation plan proposed')
  })
})
