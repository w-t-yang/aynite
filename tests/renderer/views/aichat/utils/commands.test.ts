// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Mocks ──────────────────────────────────────────────────────────────

const mockRunDirectCommand = vi.hoisted(() => vi.fn())

vi.mock('../../../../../src/renderer/bridge/ai', () => ({
  aiMutations: {
    runDirectCommand: (...args: unknown[]) => mockRunDirectCommand(...args),
  },
}))

vi.mock('../../../../../src/renderer/views/aichat/utils/message', () => ({
  genId: () => 'mocked-msg-id',
}))

import { executeCommandOnly } from '../../../../../src/renderer/views/aichat/utils/commands'

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── Tests ─────────────────────────────────────────────────────────────

describe('executeCommandOnly', () => {
  it('returns false for text without command mention', async () => {
    const result = await executeCommandOnly(
      'Hello world',
      '/test/file.ts',
      [],
      vi.fn(),
      vi.fn(),
    )
    expect(result).toBe(false)
    expect(mockRunDirectCommand).not.toHaveBeenCalled()
  })

  it('returns false for empty text', async () => {
    const result = await executeCommandOnly(
      '',
      '/test/file.ts',
      [],
      vi.fn(),
      vi.fn(),
    )
    expect(result).toBe(false)
  })

  it('returns false for whitespace-only text', async () => {
    const result = await executeCommandOnly(
      '   ',
      '/test/file.ts',
      [],
      vi.fn(),
      vi.fn(),
    )
    expect(result).toBe(false)
  })

  it('returns false for malformed command syntax', async () => {
    const result = await executeCommandOnly(
      '>cmd with no brackets',
      '/test/file.ts',
      [],
      vi.fn(),
      vi.fn(),
    )
    expect(result).toBe(false)
  })

  it('returns true and calls runDirectCommand for valid command', async () => {
    mockRunDirectCommand.mockResolvedValue({ stdout: 'done', stderr: '' })

    const setMessages = vi.fn()
    const setLoading = vi.fn()

    const result = await executeCommandOnly(
      '>cmd[ls](/)',
      '/test/file.ts',
      [],
      setMessages,
      setLoading,
    )

    expect(result).toBe(true)
    expect(mockRunDirectCommand).toHaveBeenCalledWith({
      commandPath: '/',
      params: [],
      currentFile: '/test/file.ts',
    })
    expect(setLoading).toHaveBeenCalledWith(true)
    expect(setLoading).toHaveBeenCalledWith(false)
    expect(setMessages).toHaveBeenCalled()
  })

  it('passes extracted params to runDirectCommand', async () => {
    mockRunDirectCommand.mockResolvedValue({ stdout: 'ok', stderr: '' })

    await executeCommandOnly(
      '>cmd[build](./build.sh) --prod --env staging',
      '/test/file.ts',
      [],
      vi.fn(),
      vi.fn(),
    )

    expect(mockRunDirectCommand).toHaveBeenCalledWith({
      commandPath: './build.sh',
      params: ['--prod', '--env', 'staging'],
      currentFile: '/test/file.ts',
    })
  })

  it('replaces @file mentions with paths in params', async () => {
    mockRunDirectCommand.mockResolvedValue({ stdout: 'ok', stderr: '' })

    await executeCommandOnly(
      '>cmd[format](prettier) @file[file.ts](/src/file.ts)',
      '/test/file.ts',
      [],
      vi.fn(),
      vi.fn(),
    )

    expect(mockRunDirectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        params: ['/src/file.ts'],
      }),
    )
  })

  it('replaces @dir mentions with paths in params', async () => {
    mockRunDirectCommand.mockResolvedValue({ stdout: 'ok', stderr: '' })

    await executeCommandOnly(
      '>cmd[list](ls) @dir[src](/src)',
      '/test/file.ts',
      [],
      vi.fn(),
      vi.fn(),
    )

    expect(mockRunDirectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        params: ['/src'],
      }),
    )
  })

  it('handles command execution error gracefully', async () => {
    mockRunDirectCommand.mockRejectedValue(new Error('Access denied'))

    const setMessages = vi.fn()
    const setLoading = vi.fn()

    const result = await executeCommandOnly(
      '>cmd[read](cat) /etc/passwd',
      '/test/file.ts',
      [
        { id: 'existing', role: 'user', parts: [{ type: 'text', text: 'hi' }] },
      ] as any,
      setMessages,
      setLoading,
    )

    expect(result).toBe(true)
    // Should still call setMessages with error info
    expect(setMessages).toHaveBeenCalled()
    // The messages should include an error text (appended after existing messages)
    const msgs = setMessages.mock.calls[0][0]
    expect(msgs.length).toBe(2)
    expect(msgs[1].parts[0].text).toContain('Access denied')
    expect(setLoading).toHaveBeenCalledWith(false)
  })
})
