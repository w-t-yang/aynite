import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Mocks ──────────────────────────────────────────────────────────────

const mockReaddir = vi.hoisted(() => vi.fn())
const mockReadText = vi.hoisted(() => vi.fn())
const mockReadBinary = vi.hoisted(() => vi.fn())
const mockWriteText = vi.hoisted(() => vi.fn())
const mockCheckIsTextFile = vi.hoisted(() => vi.fn())
const mockStat = vi.hoisted(() => vi.fn())
const mockEnsureDir = vi.hoisted(() => vi.fn())
const mockRename = vi.hoisted(() => vi.fn())
const mockCopy = vi.hoisted(() => vi.fn())
const mockRemove = vi.hoisted(() => vi.fn())
const mockGetIgnorePatterns = vi.hoisted(() => vi.fn())
const mockGetAbsolutePath = vi.hoisted(() => vi.fn((p: string) => p))
const mockExpandHome = vi.hoisted(() => vi.fn((p: string) => p))
const mockGetBasename = vi.hoisted(() =>
  vi.fn((p: string) => p.split('/').pop() || p),
)
const mockGetExtname = vi.hoisted(() => vi.fn((_p: string) => ''))
const mockJoinPaths = vi.hoisted(() =>
  vi.fn((...parts: string[]) => parts.join('/')),
)

vi.mock('../../../src/lib/path', () => ({
  readdir: (...args: unknown[]) => mockReaddir(...args),
  readText: (...args: unknown[]) => mockReadText(...args),
  readBinary: (...args: unknown[]) => mockReadBinary(...args),
  writeText: (...args: unknown[]) => mockWriteText(...args),
  checkIsTextFile: (...args: unknown[]) => mockCheckIsTextFile(...args),
  stat: (...args: unknown[]) => mockStat(...args),
  ensureDir: (...args: unknown[]) => mockEnsureDir(...args),
  rename: (...args: unknown[]) => mockRename(...args),
  copy: (...args: unknown[]) => mockCopy(...args),
  remove: (...args: unknown[]) => mockRemove(...args),
  expandHome: (...args: unknown[]) => mockExpandHome(...args),
  getAbsolutePath: (...args: unknown[]) => mockGetAbsolutePath(...args),
  getBasename: (...args: unknown[]) => mockGetBasename(...args),
  getExtname: (...args: unknown[]) => mockGetExtname(...args),
  joinPaths: (...args: unknown[]) => mockJoinPaths(...args),
}))

vi.mock('../../../src/main/config', () => ({
  getIgnorePatterns: (...args: unknown[]) => mockGetIgnorePatterns(...args),
}))

const mockBroadcastAppEvent = vi.hoisted(() => vi.fn())
const mockSendToWindow = vi.hoisted(() => vi.fn())
const mockGetWinIdFromSender = vi.hoisted(() => vi.fn(() => 1))

vi.mock('../../../src/main/window', () => ({
  broadcastAppEvent: (...args: unknown[]) => mockBroadcastAppEvent(...args),
  sendToWindow: (...args: unknown[]) => mockSendToWindow(...args),
  getWinIdFromSender: (...args: unknown[]) => mockGetWinIdFromSender(...args),
}))

const mockOnWindowClose = vi.hoisted(() => vi.fn())
vi.mock('../../../src/main/window-state', () => ({
  onWindowClose: (...args: unknown[]) => mockOnWindowClose(...args),
}))

const mockTrackEvent = vi.hoisted(() => vi.fn())
vi.mock('../../../src/main/telemetry/index', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}))

const mockHandleFsChange = vi.hoisted(() => vi.fn())
vi.mock('../../../src/main/git/index', () => ({
  gitService: {
    handleFsChange: (...args: unknown[]) => mockHandleFsChange(...args),
  },
}))

import { setupFileIpc } from '../../../src/main/file/index'

// Fix the mock for node:fs — needed for fsWatch in WATCH_FILE
vi.mock('node:fs', () => ({
  watch: vi.fn(() => ({
    close: vi.fn(),
  })),
}))

// We need ipcMain to capture handler registrations
const mockIpcHandle = vi.hoisted(() => vi.fn())
vi.mock('electron', () => ({
  ipcMain: {
    handle: (...args: unknown[]) => mockIpcHandle(...args),
  },
}))

// Extract FileChannels constants for assertions
import { FileChannels } from '../../../src/lib/constants/ipc-channels'

beforeEach(() => {
  vi.clearAllMocks()
  setupFileIpc()
})

function dirent(name: string, isDir: boolean) {
  return { name, isDirectory: () => isDir }
}

// ─── LIST ───────────────────────────────────────────────────────────────

describe('LIST handler', () => {
  it('lists directory contents sorted (directories first)', async () => {
    mockReaddir.mockResolvedValue([
      dirent('b-file.txt', false),
      dirent('a-dir', true),
    ])
    mockGetIgnorePatterns.mockResolvedValue([])

    const handler = getHandler(FileChannels.LIST)
    const result = await handler(null, '/some/path')

    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('a-dir')
    expect(result[0].isDirectory).toBe(true)
    expect(result[1].name).toBe('b-file.txt')
    expect(result[1].isDirectory).toBe(false)
  })

  it('filters ignored files', async () => {
    mockReaddir.mockResolvedValue([
      dirent('index.ts', false),
      dirent('node_modules', true),
      dirent('.DS_Store', false),
    ])
    mockGetIgnorePatterns.mockResolvedValue(['node_modules', '.DS_Store'])

    const handler = getHandler(FileChannels.LIST)
    const result = await handler(null, '/some/path')

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('index.ts')
  })

  it('returns empty array for non-existent directory', async () => {
    const err = new Error('ENOENT') as NodeJS.ErrnoException
    err.code = 'ENOENT'
    mockReaddir.mockRejectedValue(err)

    const handler = getHandler(FileChannels.LIST)
    const result = await handler(null, '/nonexistent')

    expect(result).toEqual([])
  })

  it('re-throws non-ENOENT errors', async () => {
    mockReaddir.mockRejectedValue(new Error('permission denied'))

    const handler = getHandler(FileChannels.LIST)
    await expect(handler(null, '/locked')).rejects.toThrow('permission denied')
  })
})

// ─── READ ───────────────────────────────────────────────────────────────

describe('READ handler', () => {
  it('reads file content', async () => {
    mockReadText.mockResolvedValue('file content')

    const handler = getHandler(FileChannels.READ)
    const result = await handler(null, '/file.txt')

    expect(result).toBe('file content')
    expect(mockReadText).toHaveBeenCalledWith('/file.txt')
  })
})

// ─── INFO ───────────────────────────────────────────────────────────────

describe('INFO handler', () => {
  it('returns file info', async () => {
    const mtime = new Date('2026-06-15T10:00:00Z')
    const birthtime = new Date('2026-06-14T10:00:00Z')
    mockStat.mockResolvedValue({
      size: 1024,
      birthtime,
      mtime,
      isDirectory: () => false,
    })
    mockCheckIsTextFile.mockResolvedValue(true)
    mockGetBasename.mockReturnValue('file.txt')
    mockGetExtname.mockReturnValue('.txt')

    const handler = getHandler(FileChannels.INFO)
    const result = await handler(null, '/file.txt')

    expect(result).toMatchObject({
      name: 'file.txt',
      size: 1024,
      isDirectory: false,
      isText: true,
    })
  })
})

// ─── CREATE ─────────────────────────────────────────────────────────────

describe('CREATE handler', () => {
  it('creates a file', async () => {
    mockWriteText.mockResolvedValue(undefined)

    const handler = getHandler(FileChannels.CREATE)
    const result = await handler(null, {
      path: '/new-file.ts',
      isDirectory: false,
    })

    expect(result).toBe(true)
    expect(mockWriteText).toHaveBeenCalledWith('/new-file.ts', '')
    expect(mockTrackEvent).toHaveBeenCalledWith('file_created', {
      is_directory: false,
    })
    expect(mockBroadcastAppEvent).toHaveBeenCalled()
    expect(mockHandleFsChange).toHaveBeenCalledWith('/new-file.ts')
  })

  it('creates a directory', async () => {
    mockEnsureDir.mockResolvedValue(undefined)

    const handler = getHandler(FileChannels.CREATE)
    const result = await handler(null, { path: '/new-dir', isDirectory: true })

    expect(result).toBe(true)
    expect(mockEnsureDir).toHaveBeenCalledWith('/new-dir')
    expect(mockTrackEvent).toHaveBeenCalledWith('file_created', {
      is_directory: true,
    })
  })
})

// ─── RENAME ─────────────────────────────────────────────────────────────

describe('RENAME handler', () => {
  it('renames a file', async () => {
    mockRename.mockResolvedValue(undefined)

    const handler = getHandler(FileChannels.RENAME)
    const result = await handler(null, {
      oldPath: '/old.ts',
      newPath: '/new.ts',
    })

    expect(result).toBe(true)
    expect(mockRename).toHaveBeenCalledWith('/old.ts', '/new.ts')
    expect(mockTrackEvent).toHaveBeenCalledWith('file_renamed')
  })
})

// ─── COPY ───────────────────────────────────────────────────────────────

describe('COPY handler', () => {
  it('copies a file', async () => {
    mockCopy.mockResolvedValue(undefined)

    const handler = getHandler(FileChannels.COPY)
    const result = await handler(null, {
      srcPath: '/src.ts',
      destPath: '/dest.ts',
    })

    expect(result).toBe(true)
    expect(mockCopy).toHaveBeenCalledWith('/src.ts', '/dest.ts', {
      recursive: true,
    })
  })
})

// ─── DELETE ─────────────────────────────────────────────────────────────

describe('DELETE handler', () => {
  it('deletes a file', async () => {
    mockRemove.mockResolvedValue(undefined)

    const handler = getHandler(FileChannels.DELETE)
    const result = await handler(null, '/to-delete.ts')

    expect(result).toBe(true)
    expect(mockRemove).toHaveBeenCalledWith('/to-delete.ts', {
      recursive: true,
      force: true,
    })
    expect(mockTrackEvent).toHaveBeenCalledWith('file_deleted')
  })
})

// ─── SAVE ───────────────────────────────────────────────────────────────

describe('SAVE handler', () => {
  it('saves content to file', async () => {
    mockWriteText.mockResolvedValue(undefined)
    mockGetExtname.mockReturnValue('.ts')

    const handler = getHandler(FileChannels.SAVE)
    const result = await handler(null, {
      path: '/file.ts',
      content: 'console.log("hi")',
    })

    expect(result).toBe(true)
    expect(mockWriteText).toHaveBeenCalledWith('/file.ts', 'console.log("hi")')
    expect(mockTrackEvent).toHaveBeenCalledWith('file_saved', {
      extension: 'ts',
    })
  })
})

// ─── WATCH_FILE ────────────────────────────────────────────────────────

describe('WATCH_FILE handler', () => {
  it('starts watching a file', async () => {
    const handler = getHandler(FileChannels.WATCH_FILE)
    await handler({ sender: { id: 1 } }, '/watch-file.ts')

    expect(mockOnWindowClose).toHaveBeenCalled()
  })

  it('closes previous watcher when starting new one', async () => {
    const closeMock = vi.fn()
    const mockWatch = (await vi.mocked(await import('node:fs')))
      .watch as ReturnType<typeof vi.fn>
    mockWatch
      .mockReturnValueOnce({ close: closeMock })
      .mockReturnValueOnce({ close: vi.fn() })

    const handler = getHandler(FileChannels.WATCH_FILE)
    await handler({ sender: { id: 1 } }, '/first.ts')
    await handler({ sender: { id: 1 } }, '/second.ts')

    expect(closeMock).toHaveBeenCalled()
  })
})

// ─── Utility ───────────────────────────────────────────────────────────

function getHandler(channel: string) {
  const registration = mockIpcHandle.mock.calls.find(
    (call: any[]) => call[0] === channel,
  )
  if (!registration) {
    throw new Error(`No handler registered for channel: ${channel}`)
  }
  return registration[1] // The handler function
}
