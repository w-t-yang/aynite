import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSpawn = vi.hoisted(() => vi.fn())

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>()
  return { ...actual, spawn: (...args: unknown[]) => mockSpawn(...args) }
})

vi.mock('../../../src/main/system/logic', () => ({
  getShellConfig: () => ({
    shell: '/bin/zsh',
    args: ['-l', '-c'],
    isWindows: false,
    isPowershell: false,
  }),
}))

vi.mock('../../../src/main/window', () => ({
  requestAiApproval: () => Promise.resolve(true),
}))

import { createRunCommand } from '../../../src/main/ai/tools/run-command'

beforeEach(() => {
  mockSpawn.mockReset()
})

function makeProc(stdout: string, exitCode = 0) {
  return {
    stdout: {
      on: vi.fn((_e: string, cb: Function) =>
        setTimeout(() => cb(Buffer.from(stdout)), 0),
      ),
    },
    stderr: { on: vi.fn() },
    stdin: { end: vi.fn(), write: vi.fn() },
    on: vi.fn((event: string, cb: Function) => {
      if (event === 'close') setTimeout(() => cb(exitCode), 5)
    }),
  }
}

describe('createRunCommand', () => {
  const context = {
    workspaceFolders: ['/home/project'],
    workspaceName: 'Dev',
    activeFile: '/home/project/src/main.ts',
    onCommandProgress: vi.fn(),
  }

  it('spawns shell and returns output on success', async () => {
    mockSpawn.mockImplementation(() => makeProc('hello world'))

    const tool = createRunCommand(['/home/project'], context)
    const result = await tool.run_command.execute({ command: 'echo hello' })

    expect(result).toBe('hello world')
    expect(mockSpawn).toHaveBeenCalledWith(
      '/bin/zsh',
      ['-l', '-c', 'echo hello'],
      expect.any(Object),
    )
  })

  it('includes stderr in output when present', async () => {
    let _stderrCb: Function | null = null
    mockSpawn.mockImplementation(() => ({
      stdout: {
        on: vi.fn((_e: string, cb: Function) =>
          setTimeout(() => cb(Buffer.from('main')), 0),
        ),
      },
      stderr: {
        on: vi.fn((_e: string, cb: Function) => {
          _stderrCb = cb
          setTimeout(() => cb(Buffer.from('warning')), 0)
        }),
      },
      stdin: { end: vi.fn(), write: vi.fn() },
      on: vi.fn((event: string, cb: Function) => {
        if (event === 'close') setTimeout(() => cb(0), 5)
      }),
    }))

    const tool = createRunCommand(['/home/project'], context)
    const result = await tool.run_command.execute({ command: 'cmd' })

    expect(result).toContain('main')
    expect(result).toContain('warning')
  })

  it('returns exit code note when non-zero exit with stdout', async () => {
    mockSpawn.mockImplementation(() => makeProc('grep output', 1))

    const tool = createRunCommand(['/home/project'], context)
    const result = await tool.run_command.execute({ command: 'grep ...' })

    expect(result).toContain('grep output')
    expect(result).toContain('code 1')
  })

  it('returns error message when non-zero exit with no stdout', async () => {
    mockSpawn.mockImplementation(() => makeProc('', 127))

    const tool = createRunCommand(['/home/project'], context)
    const result = await tool.run_command.execute({ command: 'bad' })

    expect(result).toContain('Exit code: 127')
  })
})
