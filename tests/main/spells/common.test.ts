import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Mocks ──────────────────────────────────────────────────────────────

const mockBroadcastAppEvent = vi.hoisted(() => vi.fn())
const mockReaddir = vi.hoisted(() => vi.fn())
const mockGetAbsolutePath = vi.hoisted(() =>
  vi.fn((name: string, dir: string) => `${dir}/${name}`),
)
const mockJoinPaths = vi.hoisted(() =>
  vi.fn((...parts: string[]) => parts.join('/')),
)

vi.mock('../../../src/main/window', () => ({
  broadcastAppEvent: (...args: unknown[]) => mockBroadcastAppEvent(...args),
}))

vi.mock('../../../src/main/ipc-utils', () => ({
  broadcastAppEvent: (...args: unknown[]) => mockBroadcastAppEvent(...args),
}))

vi.mock('../../../src/lib/path', () => ({
  readdir: (...args: unknown[]) => mockReaddir(...args),
  getAbsolutePath: (...args: unknown[]) => mockGetAbsolutePath(...args),
  joinPaths: (...args: string[]) => mockJoinPaths(...args),
}))

vi.mock('electron', () => ({
  app: {
    get isPackaged() {
      return mockIsPackaged.value
    },
  },
}))

const mockIsPackaged = vi.hoisted(() => ({ value: false }))

import {
  findFilesRecursively,
  getBundledResourcesPath,
  notifyError,
} from '../../../src/main/spells/common'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('notifyError', () => {
  it('broadcasts event for first error occurrence', () => {
    notifyError('skill', '/path/to/skill', 'YAML parse error')
    expect(mockBroadcastAppEvent).toHaveBeenCalledWith('config-error', {
      type: 'skill',
      path: '/path/to/skill',
      error: 'YAML parse error',
    })
  })

  it('skips broadcast for duplicate error', () => {
    notifyError('skill', '/path', 'error msg')
    notifyError('skill', '/path', 'error msg')
    expect(mockBroadcastAppEvent).toHaveBeenCalledTimes(1)
  })

  it('broadcasts again for different path', () => {
    notifyError('skill', '/path/a', 'error msg')
    notifyError('skill', '/path/b', 'error msg')
    expect(mockBroadcastAppEvent).toHaveBeenCalledTimes(2)
  })
})

describe('getBundledResourcesPath', () => {
  const OLD_CWD = process.cwd

  afterEach(() => {
    process.cwd = OLD_CWD
  })

  it('returns process.resourcesPath when packaged', () => {
    mockIsPackaged.value = true
    process.resourcesPath = '/app/resources'
    const result = getBundledResourcesPath()
    expect(result).toBe('/app/resources')
  })

  it('returns cwd/resources in dev mode', () => {
    mockIsPackaged.value = false
    process.cwd = vi.fn(() => '/dev/project')
    const result = getBundledResourcesPath()
    expect(result).toBe('/dev/project/resources')
  })
})

describe('findFilesRecursively', () => {
  function dirent(name: string, isDir: boolean) {
    return { name, isDirectory: () => isDir, isFile: () => !isDir }
  }

  it('finds matching files in directory', async () => {
    mockReaddir.mockResolvedValueOnce([
      dirent('SKILL.md', false),
      dirent('README.md', false),
      dirent('config.json', false),
    ])

    const result = await findFilesRecursively('/skills', [
      'SKILL.md',
      'README.md',
    ])
    expect(result).toEqual(['/skills/SKILL.md', '/skills/README.md'])
  })

  it('recurses into subdirectories', async () => {
    mockReaddir
      .mockResolvedValueOnce([dirent('subdir', true)])
      .mockResolvedValueOnce([dirent('SKILL.md', false)])

    const result = await findFilesRecursively('/skills', ['SKILL.md'])
    expect(result).toEqual(['/skills/subdir/SKILL.md'])
  })

  it('skips ignored directories', async () => {
    mockReaddir
      .mockResolvedValueOnce([
        dirent('node_modules', true),
        dirent('.git', true),
        dirent('src', true),
      ])
      .mockResolvedValueOnce([dirent('SKILL.md', false)])

    const result = await findFilesRecursively('/skills', ['SKILL.md'])
    expect(result).toEqual(['/skills/src/SKILL.md'])
  })

  it('returns empty array on read error', async () => {
    mockReaddir.mockRejectedValueOnce(new Error('ENOENT'))
    const result = await findFilesRecursively('/missing', ['SKILL.md'])
    expect(result).toEqual([])
  })

  it('accepts custom ignore directories', async () => {
    mockReaddir
      .mockResolvedValueOnce([dirent('temp', true)])
      .mockResolvedValueOnce([dirent('SKILL.md', false)])

    const result = await findFilesRecursively(
      '/skills',
      ['SKILL.md'],
      ['temp', '.git'],
    )
    expect(result).toEqual([]) // temp is ignored, nothing else found
  })
})
