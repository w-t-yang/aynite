import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Mocks ──────────────────────────────────────────────────────────────

const mockReadFileSync = vi.hoisted(() => vi.fn())

vi.mock('node:fs', () => ({
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
}))

const mockGetWorkspacesConfigPath = vi.hoisted(() =>
  vi.fn(() => '/mock/.aynite/config/workspaces.json'),
)
const mockGetWorkspacesList = vi.hoisted(() => vi.fn())

vi.mock('../../src/lib/path', () => ({
  getWorkspacesConfigPath: (...args: unknown[]) =>
    mockGetWorkspacesConfigPath(...args),
}))

vi.mock('../../src/main/workspace/logic', () => ({
  getWorkspacesList: (...args: unknown[]) => mockGetWorkspacesList(...args),
}))

import {
  getAllWindowIds,
  getWindowSession,
  getWindowWorkspace,
  hasWindow,
  onWindowClose,
  registerWindow,
  setWindowWorkspace,
  unregisterWindow,
} from '../../src/main/window-state'

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── registerWindow ─────────────────────────────────────────────────────

describe('registerWindow', () => {
  it('registers a window with workspace from config', () => {
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ active: 'Dev', list: ['Dev', 'Playbook'] }),
    )

    const session = registerWindow(1)

    expect(session).toEqual({
      workspaceId: 'Dev',
      workspacePinned: false,
    })
    expect(hasWindow(1)).toBe(true)
    expect(getWindowSession(1)).toEqual(session)
  })

  it('falls back to Aynite Playbook when config read fails', () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error('ENOENT')
    })

    const session = registerWindow(2)
    expect(session).toEqual({
      workspaceId: 'Aynite Playbook',
      workspacePinned: false,
    })
  })

  it('falls back to Aynite Playbook when config has no active field', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ list: ['Dev'] }))

    const session = registerWindow(3)
    expect(session.workspaceId).toBe('Aynite Playbook')
  })

  it('returns existing session for already-registered window', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ active: 'Dev' }))

    registerWindow(1)
    const session2 = registerWindow(1) // same window registers again

    expect(session2.workspaceId).toBe('Dev')
  })

  it('assigns unique sessions to different windows', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ active: 'Default' }))

    const s1 = registerWindow(10)
    const s2 = registerWindow(20)

    expect(s1).not.toBe(s2) // different objects
    expect(s1.workspaceId).toBe('Default')
    expect(s2.workspaceId).toBe('Default')
  })
})

// ─── unregisterWindow ───────────────────────────────────────────────────

describe('unregisterWindow', () => {
  it('unregisters a window', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ active: 'Dev' }))
    registerWindow(1)
    expect(hasWindow(1)).toBe(true)

    unregisterWindow(1)
    expect(hasWindow(1)).toBe(false)
  })

  it('fires cleanup callbacks on unregister', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ active: 'Dev' }))
    registerWindow(1)

    const cleanup1 = vi.fn()
    const cleanup2 = vi.fn()
    onWindowClose(1, cleanup1)
    onWindowClose(1, cleanup2)

    unregisterWindow(1)

    expect(cleanup1).toHaveBeenCalledOnce()
    expect(cleanup2).toHaveBeenCalledOnce()
    expect(hasWindow(1)).toBe(false)
  })

  it('handles cleanup callback errors gracefully', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ active: 'Dev' }))
    registerWindow(1)

    const badCleanup = vi.fn(() => {
      throw new Error('cleanup failed')
    })
    const goodCleanup = vi.fn()
    onWindowClose(1, badCleanup)
    onWindowClose(1, goodCleanup)

    unregisterWindow(1)

    expect(goodCleanup).toHaveBeenCalledOnce()
    expect(hasWindow(1)).toBe(false)
  })

  it('does nothing for unregistered window', () => {
    expect(() => unregisterWindow(999)).not.toThrow()
  })
})

// ─── getWindowWorkspace ────────────────────────────────────────────────

describe('getWindowWorkspace', () => {
  it('returns workspace for registered window', async () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ active: 'Dev' }))
    registerWindow(1)

    const ws = await getWindowWorkspace(1)
    expect(ws).toBe('Dev')
  })

  it('falls back to global config for unregistered window', async () => {
    mockGetWorkspacesList.mockResolvedValue({
      active: 'Global',
      list: ['Global'],
    })

    const ws = await getWindowWorkspace(999)
    expect(ws).toBe('Global')
  })

  it('falls back to Aynite Playbook when global config also fails', async () => {
    mockGetWorkspacesList.mockRejectedValue(new Error('fail'))

    const ws = await getWindowWorkspace(999)
    expect(ws).toBe('Aynite Playbook')
  })
})

// ─── setWindowWorkspace ────────────────────────────────────────────────

describe('setWindowWorkspace', () => {
  it('sets workspace and marks as pinned', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ active: 'Dev' }))
    registerWindow(1)

    setWindowWorkspace(1, 'Playbook')

    const session = getWindowSession(1)
    expect(session?.workspaceId).toBe('Playbook')
    expect(session?.workspacePinned).toBe(true)
  })

  it('does nothing for unregistered window', () => {
    expect(() => setWindowWorkspace(999, 'Other')).not.toThrow()
    expect(getWindowSession(999)).toBeUndefined()
  })
})

// ─── hasWindow / getAllWindowIds ────────────────────────────────────────

describe('hasWindow / getAllWindowIds', () => {
  it('checks window existence', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ active: 'Dev' }))
    // Use unique window ID not used by previous tests
    expect(hasWindow(50)).toBe(false)

    registerWindow(50)
    expect(hasWindow(50)).toBe(true)
  })

  it('lists all registered window IDs', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ active: 'Dev' }))

    registerWindow(100)
    registerWindow(200)
    registerWindow(300)

    const ids = getAllWindowIds()
    expect(ids).toContain(100)
    expect(ids).toContain(200)
    expect(ids).toContain(300)
  })

  it('does not report unregistered windows', () => {
    expect(hasWindow(9999)).toBe(false)
  })
})

// ─── onWindowClose ──────────────────────────────────────────────────────

describe('onWindowClose', () => {
  it('registers cleanup callback', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ active: 'Dev' }))
    registerWindow(1)

    const cleanup = vi.fn()
    onWindowClose(1, cleanup)
    // Cleanup not called yet
    expect(cleanup).not.toHaveBeenCalled()

    unregisterWindow(1)
    expect(cleanup).toHaveBeenCalledOnce()
  })

  it('supports multiple callbacks for same window', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ active: 'Dev' }))
    registerWindow(1)

    const cb1 = vi.fn()
    const cb2 = vi.fn()
    onWindowClose(1, cb1)
    onWindowClose(1, cb2)
    unregisterWindow(1)

    expect(cb1).toHaveBeenCalledOnce()
    expect(cb2).toHaveBeenCalledOnce()
  })
})
