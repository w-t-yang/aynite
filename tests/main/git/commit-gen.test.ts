import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Mocks ──────────────────────────────────────────────────────────────

const mockExecAsync = vi.hoisted(() => vi.fn())
const mockStreamText = vi.hoisted(() => vi.fn())
const mockGetAIModel = vi.hoisted(() => vi.fn())

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>()
  return {
    ...actual,
    exec: vi.fn(),
  }
})

// Need to mock promisify to return our mockExecAsync
vi.mock('node:util', () => ({
  promisify: () => mockExecAsync,
}))

vi.mock('ai', () => ({
  streamText: (...args: unknown[]) => mockStreamText(...args),
}))

vi.mock('../../../src/main/config', () => ({
  loadConfig: vi.fn(),
}))

vi.mock('../../../src/main/ai', () => ({
  getAIModel: (...args: unknown[]) => mockGetAIModel(...args),
  DISABLED_REASONING_OPTIONS: {},
}))

import { loadConfig } from '../../../src/main/config'
import { generateCommitMessage } from '../../../src/main/git/commit-gen'

beforeEach(() => {
  vi.clearAllMocks()
})

function makeStream(parts: { type: string; text?: string }[]) {
  return {
    fullStream: (async function* () {
      for (const p of parts) yield p
    })(),
  }
}

describe('generateCommitMessage', () => {
  it('returns error when no files changed', async () => {
    // git status --short returns empty string
    mockExecAsync
      .mockResolvedValueOnce({ stdout: '' })
      .mockResolvedValueOnce({ stdout: '' })
      .mockResolvedValueOnce({ stdout: '' })

    const result = await generateCommitMessage('/repo')
    expect(result.error).toContain('No changes')
  })

  it('returns error when no AI provider configured', async () => {
    mockExecAsync
      .mockResolvedValueOnce({ stdout: ' M file.ts\n' })
      .mockResolvedValueOnce({ stdout: '' })
      .mockResolvedValueOnce({ stdout: '' })
    vi.mocked(loadConfig).mockResolvedValue({
      ai: { providers: [], activeId: null },
    } as any)

    const result = await generateCommitMessage('/repo')
    expect(result.error).toContain('No AI provider')
  })

  it('returns error when AI model creation fails', async () => {
    mockExecAsync
      .mockResolvedValueOnce({ stdout: ' M file.ts\n' })
      .mockResolvedValueOnce({ stdout: '' })
      .mockResolvedValueOnce({ stdout: '' })
    vi.mocked(loadConfig).mockResolvedValue({
      ai: {
        providers: [{ id: 'test', provider: 'openai' }],
        activeId: 'test',
      },
    } as any)
    mockGetAIModel.mockImplementation(() => {
      throw new Error('invalid API key')
    })

    const result = await generateCommitMessage('/repo')
    expect(result.error).toContain('AI model error')
    expect(result.error).toContain('invalid API key')
  })

  it('returns a generated commit message on success', async () => {
    mockExecAsync
      .mockResolvedValueOnce({ stdout: ' M src/main.ts\n' })
      .mockResolvedValueOnce({ stdout: ' 1 file changed, 1 insertion(+)\n' })
      .mockResolvedValueOnce({ stdout: '' })

    vi.mocked(loadConfig).mockResolvedValue({
      ai: {
        providers: [{ id: 'test', provider: 'openai', model: 'gpt-4' }],
        activeId: 'test',
      },
    } as any)
    mockGetAIModel.mockReturnValue({})

    // Simulate AI response
    mockStreamText.mockReturnValue(
      makeStream([
        { type: 'text-delta', text: 'fix: update main module' },
        { type: 'text-delta', text: '\n\n- Refactor entry point' },
        { type: 'finish' },
      ]),
    )

    // The diff calls happen inside the for loop
    // mockExecAsync for git diff --cached and git diff (no flag)
    // They're called after the initial 3 calls
    mockExecAsync
      .mockResolvedValueOnce({
        stdout:
          'diff --git a/src/main.ts b/src/main.ts\n@@ -1,3 +1,3 @@\n-import old\n+import new\n',
      })
      .mockResolvedValueOnce({ stdout: '' })

    const result = await generateCommitMessage('/repo')
    expect(result.message).toBeDefined()
    expect(result.message).toContain('fix: update main module')
    expect(result.modelName).toBe('gpt-4')
  })

  it('returns error when AI returns empty text', async () => {
    mockExecAsync
      .mockResolvedValueOnce({ stdout: ' M file.ts\n' })
      .mockResolvedValueOnce({ stdout: '' })
      .mockResolvedValueOnce({ stdout: '' })
    vi.mocked(loadConfig).mockResolvedValue({
      ai: {
        providers: [{ id: 'test', provider: 'openai' }],
        activeId: 'test',
      },
    } as any)
    mockGetAIModel.mockReturnValue({})
    mockStreamText.mockReturnValue(makeStream([{ type: 'finish' }]))

    // Add diff mock for the loop
    mockExecAsync
      .mockResolvedValueOnce({ stdout: '' })
      .mockResolvedValueOnce({ stdout: '' })

    const result = await generateCommitMessage('/repo')
    expect(result.error).toContain('empty response')
  })

  it('handles staged changes correctly', async () => {
    // Staged changes use different prefixes
    mockExecAsync
      .mockResolvedValueOnce({ stdout: 'M  src/main.ts\n' })
      .mockResolvedValueOnce({ stdout: ' 1 file changed, 1 insertion(+)\n' })
      .mockResolvedValueOnce({ stdout: ' 1 file changed, 1 insertion(+)\n' })
    vi.mocked(loadConfig).mockResolvedValue({
      ai: {
        providers: [{ id: 'test', provider: 'openai', model: 'gpt-4' }],
        activeId: 'test',
      },
    } as any)
    mockGetAIModel.mockReturnValue({})
    mockStreamText.mockReturnValue(
      makeStream([
        { type: 'text-delta', text: 'feat: add new feature' },
        { type: 'finish' },
      ]),
    )
    mockExecAsync
      .mockResolvedValueOnce({
        stdout: 'diff --git a/src/main.ts\n@@ -1 +1 @@\n-old\n+new\n',
      })
      .mockResolvedValueOnce({ stdout: '' })

    const result = await generateCommitMessage('/repo')
    expect(result.message).toContain('feat: add new feature')
  })
})
