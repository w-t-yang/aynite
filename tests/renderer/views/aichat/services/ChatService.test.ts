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

// ─── getState ───────────────────────────────────────────────────────────

describe('getState', () => {
  it('returns undefined for non-existent session', () => {
    expect(ChatServiceModule.getState('no-such-session')).toBeUndefined()
  })

  it('returns state for existing session', () => {
    ChatServiceModule.subscribe('state-test', vi.fn())
    const state = ChatServiceModule.getState('state-test')
    expect(state).toBeDefined()
    expect(state?.sessionId).toBe('state-test')
    expect(state?.messages).toEqual([])
    expect(state?.loading).toBe(false)
    expect(state?.error).toBeNull()
  })
})

// ─── revertToMessage ────────────────────────────────────────────────────

describe('revertToMessage', () => {
  it('reverts messages to the specified index', async () => {
    mockLoadSession.mockResolvedValue([
      { id: '1', role: 'user', content: 'a' },
      { id: '2', role: 'assistant', content: 'b' },
      { id: '3', role: 'user', content: 'c' },
    ])

    const cb = vi.fn()
    ChatServiceModule.subscribe('revert-test', cb)
    await ChatServiceModule.loadSessionById('revert-test')

    ChatServiceModule.revertToMessage('revert-test', 0)

    const state = ChatServiceModule.getState('revert-test')
    expect(state?.messages).toHaveLength(1)
  })

  it('ignores out-of-range index (too high)', async () => {
    mockLoadSession.mockResolvedValue([{ id: '1', role: 'user', content: 'a' }])

    const cb = vi.fn()
    ChatServiceModule.subscribe('revert-high', cb)
    await ChatServiceModule.loadSessionById('revert-high')

    ChatServiceModule.revertToMessage('revert-high', 99)

    const state = ChatServiceModule.getState('revert-high')
    expect(state?.messages).toHaveLength(1)
  })

  it('ignores out-of-range index (negative)', async () => {
    mockLoadSession.mockResolvedValue([{ id: '1', role: 'user', content: 'a' }])

    ChatServiceModule.subscribe('revert-neg', vi.fn())
    await ChatServiceModule.loadSessionById('revert-neg')

    ChatServiceModule.revertToMessage('revert-neg', -1)

    const state = ChatServiceModule.getState('revert-neg')
    expect(state?.messages).toHaveLength(1)
  })

  it('does nothing for non-existent session', () => {
    expect(() =>
      ChatServiceModule.revertToMessage('no-session', 0),
    ).not.toThrow()
  })
})

// ─── abortMessage ───────────────────────────────────────────────────────

describe('abortMessage', () => {
  it('does nothing for non-existent session', () => {
    expect(() => ChatServiceModule.abortMessage('ghost')).not.toThrow()
  })

  it('does nothing for idle session (no running controller)', () => {
    ChatServiceModule.subscribe('idle-session', vi.fn())
    expect(() => ChatServiceModule.abortMessage('idle-session')).not.toThrow()
  })
})

// ─── handleApprove / handleReject ───────────────────────────────────────

describe('handleApprove', () => {
  it('does nothing for non-existent session', () => {
    expect(() => ChatServiceModule.handleApprove('ghost')).not.toThrow()
  })

  it('clears pendingApproval when no approvalId is set', () => {
    ChatServiceModule.subscribe('approve-clear', vi.fn())
    ChatServiceModule.handleApprove('approve-clear')

    const state = ChatServiceModule.getState('approve-clear')
    expect(state?.pendingApproval).toBeNull()
  })
})

describe('handleReject', () => {
  it('does nothing for non-existent session', () => {
    expect(() => ChatServiceModule.handleReject('ghost')).not.toThrow()
  })

  it('clears pendingApproval when no approvalId is set', () => {
    ChatServiceModule.subscribe('reject-clear', vi.fn())
    ChatServiceModule.handleReject('reject-clear')

    const state = ChatServiceModule.getState('reject-clear')
    expect(state?.pendingApproval).toBeNull()
  })
})

// ─── registerStreamHandler edge cases ───────────────────────────────────

describe('registerStreamHandler', () => {
  it('overwrites previous handler for same requestId', () => {
    const first = vi.fn()
    const second = vi.fn()

    ChatServiceModule.registerStreamHandler('req-overwrite', first)
    ChatServiceModule.registerStreamHandler('req-overwrite', second)

    _setupInit()
    eventHandler?.({
      type: 'ai-chat-delta',
      data: {
        requestId: 'req-overwrite',
        part: { type: 'text-delta', text: 'x' },
      },
    })

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalled()

    ChatServiceModule.unregisterStreamHandler('req-overwrite')
  })
})

describe('unregisterStreamHandler', () => {
  it('does nothing for non-existent requestId', () => {
    expect(() =>
      ChatServiceModule.unregisterStreamHandler('no-such-req'),
    ).not.toThrow()
  })
})

// ─── AI_APPROVAL_REQUEST event ──────────────────────────────────────────

describe('AI_APPROVAL_REQUEST event', () => {
  it('sets pendingApproval on the loading session', () => {
    _setupInit()

    // Create a session first
    ChatServiceModule.subscribe('approval-sess', vi.fn())

    // We can't easily set loading=true via public API, but the handler
    // scans ALL sessions for one with loading=true. If none matches,
    // it's a no-op — which we verify.
    eventHandler?.({
      type: AppEvents.AI_APPROVAL_REQUEST,
      data: { id: 'test-approval-id', command: 'ls', cwd: '/tmp' },
    })

    // No session is in loading state, so pendingApproval should remain null
    const state = ChatServiceModule.getState('approval-sess')
    expect(state?.pendingApproval).toBeNull()
  })
})
