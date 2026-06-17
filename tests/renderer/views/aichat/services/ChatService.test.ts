import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppEvents } from '../../../../../src/lib/constants/app'

// ─── Mocks ──────────────────────────────────────────────────────────────

const mockLoadSession = vi.hoisted(() => vi.fn())
const mockSaveSession = vi.hoisted(() => vi.fn())
const mockGet = vi.hoisted(() => vi.fn())
const mockFolders = vi.hoisted(() => vi.fn())
const mockGetMergedSystemPrompt = vi.hoisted(() => vi.fn())

vi.mock('../../../../../src/renderer/bridge/ai', () => ({
  ai: {
    loadSession: (...args: unknown[]) => mockLoadSession(...args),
    getMergedSystemPrompt: (...args: unknown[]) =>
      mockGetMergedSystemPrompt(...args),
    getArtifactsStatus: vi.fn(() => null),
    listSessions: vi.fn(() => []),
  },
  aiMutations: {
    saveSession: (...args: unknown[]) => mockSaveSession(...args),
    chat: vi.fn(() => ({ requestId: 'test-request' })),
    runDirectCommand: vi.fn(() => ({ stdout: '', stderr: '' })),
    respondToAiApproval: vi.fn(),
    restorePrompts: vi.fn(),
  },
}))

vi.mock('../../../../../src/renderer/bridge/config', () => ({
  config: {
    get: (...args: unknown[]) => mockGet(...args),
  },
  configMutations: {
    set: vi.fn(() => Promise.resolve()),
  },
}))

vi.mock('../../../../../src/renderer/bridge/workspace', () => ({
  workspace: {
    folders: (...args: unknown[]) => mockFolders(...args),
    allFiles: vi.fn(() => []),
  },
}))

// Must import after mocks
import * as ChatServiceModule from '../../../../../src/renderer/views/aichat/services/ChatService'

// ─── Shared: call init ONCE for all event-handler tests ─────────────────

let eventHandler: ((event: any) => void) | null = null
let initDone = false

const _setupInit = () => {
  if (initDone) return
  initDone = true
  const subscribe = vi.fn()
  ChatServiceModule.init(subscribe)
  const initCall = vi
    .mocked(subscribe)
    .mock.calls.find(([fn]: [any]) => typeof fn === 'function')
  if (initCall) {
    eventHandler = initCall[0]
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── init ────────────────────────────────────────────────────────────────

describe('init', () => {
  it('calls subscribe with event handler', () => {
    _setupInit()
    expect(eventHandler).toBeDefined()
  })

  it('is idempotent (second call does not re-subscribe)', () => {
    const subscribe = vi.fn()
    ChatServiceModule.init(subscribe)
    // Already called once above — this should be a no-op
    expect(subscribe).not.toHaveBeenCalled()
  })
})

// ─── ACTIVE_SESSION_CHANGED event handling ──────────────────────────────

describe('ACTIVE_SESSION_CHANGED event', () => {
  it('loads session from disk when session is not in memory', async () => {
    _setupInit()

    const messages = [{ role: 'user', content: 'loaded' }]
    mockLoadSession.mockResolvedValue(messages)

    eventHandler?.({
      type: AppEvents.ACTIVE_SESSION_CHANGED,
      data: { id: 'sess-event-1' },
    })

    await vi.waitFor(() => {
      expect(mockLoadSession).toHaveBeenCalledWith('sess-event-1', undefined)
    })
  })

  it('does not load when session is already in memory', async () => {
    _setupInit()

    // Pre-populate the session
    mockLoadSession.mockResolvedValue([{ role: 'user', content: 'preloaded' }])
    await ChatServiceModule.loadSessionById('sess-cached')
    mockLoadSession.mockClear()

    eventHandler?.({
      type: AppEvents.ACTIVE_SESSION_CHANGED,
      data: { id: 'sess-cached' },
    })

    await new Promise((r) => setTimeout(r, 10))
    expect(mockLoadSession).not.toHaveBeenCalled()
  })
})

// ─── stream dispatch ────────────────────────────────────────────────────

describe('stream dispatch', () => {
  it('dispatches ai-chat-delta events to registered handler', () => {
    _setupInit()

    const handler = vi.fn()
    const part = { type: 'text-delta', text: 'hello' }

    ChatServiceModule.registerStreamHandler('req-1', handler)

    eventHandler?.({
      type: 'ai-chat-delta',
      data: { requestId: 'req-1', part },
    })

    expect(handler).toHaveBeenCalledWith(part)
    ChatServiceModule.unregisterStreamHandler('req-1')
  })

  it('does not dispatch to unregistered handler', () => {
    _setupInit()

    const handler = vi.fn()

    eventHandler?.({
      type: 'ai-chat-delta',
      data: { requestId: 'req-2', part: {} },
    })

    expect(handler).not.toHaveBeenCalled()
  })
})

// ─── subscribe ───────────────────────────────────────────────────────────

describe('subscribe', () => {
  it('returns an unsubscribe function', () => {
    const unsubscribe = ChatServiceModule.subscribe('sess-1', vi.fn())
    expect(typeof unsubscribe).toBe('function')
  })

  it('calls callback immediately with current state', () => {
    const cb = vi.fn()
    ChatServiceModule.subscribe('sess-2', cb)
    expect(cb).toHaveBeenCalledTimes(1)
    expect(cb.mock.calls[0][0]).toMatchObject({
      sessionId: 'sess-2',
      messages: [],
    })
  })
})

// ─── hasSession ──────────────────────────────────────────────────────────

describe('hasSession', () => {
  it('returns false for non-existent session', () => {
    expect(ChatServiceModule.hasSession('no-such-session')).toBe(false)
  })

  it('returns true after session is created via subscribe', () => {
    ChatServiceModule.subscribe('exist-session', vi.fn())
    expect(ChatServiceModule.hasSession('exist-session')).toBe(true)
  })
})

// ─── clearChat ──────────────────────────────────────────────────────────

describe('clearChat', () => {
  it('clears messages and preserves session ID', () => {
    const cb = vi.fn()
    ChatServiceModule.subscribe('clear-test', cb)

    ChatServiceModule.clearChat('clear-test')

    const lastState = cb.mock.calls[cb.mock.calls.length - 1][0]
    expect(lastState.messages).toEqual([])
    expect(lastState.sessionId).toBe('clear-test')
  })
})

// ─── clearError ─────────────────────────────────────────────────────────

describe('clearError', () => {
  it('clears error state for a session', () => {
    const cb = vi.fn()
    ChatServiceModule.subscribe('err-test', cb)

    ChatServiceModule.clearError('err-test')

    const lastState = cb.mock.calls[cb.mock.calls.length - 1][0]
    expect(lastState.error).toBeNull()
  })
})

// ─── createNewSession ───────────────────────────────────────────────────

describe('createNewSession', () => {
  it('creates a new session and returns its ID', async () => {
    mockSaveSession.mockResolvedValue(undefined)

    const id = await ChatServiceModule.createNewSession()

    expect(id).toBeTruthy()
    expect(typeof id).toBe('string')
    expect(mockSaveSession).toHaveBeenCalledWith(id, [])
  })
})

// ─── loadSessionById ─────────────────────────────────────────────────────

describe('loadSessionById', () => {
  it('loads messages from bridge and notifies subscribers', async () => {
    const messages = [{ role: 'user', content: 'hello' }]
    mockLoadSession.mockResolvedValue(messages)

    const cb = vi.fn()
    ChatServiceModule.subscribe('sess-load-test', cb)
    await ChatServiceModule.loadSessionById('sess-load-test')

    expect(mockLoadSession).toHaveBeenCalledWith('sess-load-test', undefined)
    const stateCalls = cb.mock.calls.filter(([s]: any) => s.messages.length > 0)
    expect(stateCalls.length).toBeGreaterThanOrEqual(1)
  })

  it('passes stored date to bridge when available', async () => {
    const messages = [{ role: 'user', content: 'hello' }]
    mockLoadSession.mockResolvedValue(messages)

    ChatServiceModule.setPendingSessionDate('sess-date-2', '2026-06-15')
    await ChatServiceModule.loadSessionById('sess-date-2')

    expect(mockLoadSession).toHaveBeenCalledWith('sess-date-2', '2026-06-15')
  })

  it('clears stored date after use', async () => {
    mockLoadSession.mockResolvedValue([])

    ChatServiceModule.setPendingSessionDate('sess-date-3', '2026-06-15')
    await ChatServiceModule.loadSessionById('sess-date-3')

    // Second call without setting date again should not pass date
    await ChatServiceModule.loadSessionById('sess-date-3')
    const calls = mockLoadSession.mock.calls
    const lastCall = calls[calls.length - 1]
    expect(lastCall[1]).toBeUndefined()
  })

  it('warns but does not throw when session not found', async () => {
    mockLoadSession.mockResolvedValue(null)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const cb = vi.fn()
    ChatServiceModule.subscribe('sess-missing', cb)

    await ChatServiceModule.loadSessionById('sess-missing')
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('not found'))
    expect(cb.mock.calls[0][0].messages).toEqual([])
    warnSpy.mockRestore()
  })
})

// ─── setPendingSessionDate ──────────────────────────────────────────────

describe('setPendingSessionDate', () => {
  it('stores date for subsequent loadSessionById', async () => {
    mockLoadSession.mockResolvedValue([])

    ChatServiceModule.setPendingSessionDate('sess-d', '2026-06-14')
    await ChatServiceModule.loadSessionById('sess-d')

    expect(mockLoadSession).toHaveBeenCalledWith('sess-d', '2026-06-14')
  })
})
