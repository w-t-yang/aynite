# RFC-002: Session Manager Architecture

**Status:** Draft  
**Date:** 2026-05-23  
**Author:** Aynite Team

---

## Objective

This document describes the Session Manager architecture — a module-level service that decouples
AI Chat agent loops from React component lifecycles. This architecture enables:

1. **Agent loops that survive view switches** — streaming/tool execution continues when the user
   navigates away from the chat view and resumes when they return.
2. **Future multi-session support** — each session (agent conversation) has fully independent
   state, abort controller, and streaming.
3. **No orphaned listeners** — a single permanent event listener replaces per-call subscriptions.

---

## Problem: React-Bound Agent Loop

Previously, all agent loop state lived in the `useAIChat` React hook:

```
┌─────────────────────────────────────────┐
│           AIChat (React component)       │
│                                          │
│  useAIChat() {                           │
│    const [messages, setMessages]         │
│    const [loading, setLoading]           │
│    const abortRef = useRef(null)         │
│                                          │
│    async function sendMessage() {        │
│      abortRef.current = new AbortCtrl()  │
│      const result = await runAgentLoop(  │
│        ...,                              │
│        subscribe,   ← new listener each  │
│        onEvent      ← setMessages()      │
│      )                                   │
│    }                                     │
│  }                                       │
└─────────────────────────────────────────┘
```

**Problems:**
- When the component unmounts (view switch, layout change), all state is destroyed.
- The `onEvent` callback captures `setMessages` — becomes a stale setter on unmounted components.
- Each `runAgentLoop` call creates a new `window.message` listener.
- The `useAppEventSubscriber()` call at line 105 discards its cleanup function → listeners leak.
- No path to multi-session support — state is tied to a single React component instance.

---

## Solution: Session Manager Service

```
┌─────────────────────────────────────────────────────────────────────┐
│                     ChatService (module-level)                       │
│                                                                      │
│  // Permanent state — never dies                                    │
│  const sessions = Map<sessionId, InternalSession>                   │
│  const activeStreams = Map<requestId, handler>                      │
│  let permanentListener: () => void  // one listener, forever        │
│                                                                      │
│  init(subscribe)  ← called once, sets up permanent listener         │
│  getOrCreateSession(id) → InternalSession                           │
│  sendMessage(id, text)  ← fetches config via IPC directly           │
│  subscribe(id, cb) → unsubscribe  ← React reads state here          │
│  registerStreamHandler(id, handler)  ← used by runAgentLoop         │
│  clearChat(id) / handleApprove(id) / handleReject(id)               │
└─────────────────────────┬───────────────────────────────────────────┘
                          │ subscribe(sessionId, cb)
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                 useAIChat (thin React wrapper)                       │
│                                                                      │
│  // Only UI-level state lives in React                               │
│  const [settings, setSettings]                                       │
│  const [workspaceFolders, setWorkspaceFolders]                       │
│                                                                      │
│  // Session state is read from ChatService                           │
│  useEffect(() => ChatService.subscribe(id, setState), [id])          │
│                                                                      │
│  // Actions delegate to ChatService                                  │
│  const sendMessage = (text) => ChatService.sendMessage(id, text)     │
└─────────────────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

| Layer | File | Responsibility |
|-------|------|----------------|
| **ChatService** | `services/ChatService.ts` | Module-level singleton. Owns all session state, agent loops, auto-save, stream dispatch, approval handling. Reads config/workspace directly via IPC. |
| **useAIChat** | `hooks/useAIChat.ts` | Thin React wrapper. Owns UI-level state (settings display, workspace folder list, artifact status). Subscribes to ChatService for session state. Delegates all actions. |
| **runAgentLoop** | `utils/agent.ts` | Pure utility (no React). Manages the streaming loop, accumulates messages, handles tool calls/results. Uses `registerStream` to connect to ChatService's permanent listener. |

### Data Flow

```
User sends message:
  AIChat.tsx
    → useAIChat.sendMessage(text)
      → ChatService.sendMessage(sessionId, text)
        → Fetches config/workspace via IPC (window.aynite.getConfig)
        → Updates session.messages (notify listeners → React re-render)
        → Calls runAgentLoop(messages, config, ..., registerStream)
          → Calls window.aynite.aiChat({...})  → gets requestId
          → Calls registerStream(requestId, handler)
            → ChatService.activeStreams.set(requestId, handler)
          → Stream events arrive via permanent listener:
            ChatService init()'s subscribe callback receives ai-chat-delta
            → Looks up handler by requestId
            → Calls handler(part)
              → runAgentLoop processes part (text-delta, tool-call, etc.)
              → Calls onEvent(part)
                → ChatService updates session state
                → Notifies React subscribers
```

### Event Listener Architecture

```
Main Process                    ChatService (permanent listener)
sendAppEvent(                   subscribe((event) => {
  AI_CHAT_DELTA,                  if (event.type === 'ai-chat-delta') {
  { requestId, part }               const handler = activeStreams.get(requestId)
  )                                handler(part)
                                 }
                                 ...)
```

**Key principle:** ONE `window.message` listener (via `useAppEventSubscriber` bridge) handles ALL
streaming events for ALL sessions. Each session's `runAgentLoop` registers a handler keyed by
`requestId`, which is cleaned up when the stream finishes.

### Workspace/Layout Switch Behavior

| Event | Behavior |
|-------|----------|
| **View switch** (chat → file → back) | ChatService state persists. On re-mount, `useAIChat` subscribes to the same session — sees latest messages/loading state immediately. Agent loop continues uninterrupted. |
| **Workspace switch** | All sessions should be aborted (safety — tool context would be stale). Add `ChatService.abortAllSessions()` called from the workspace-changed handler. |
| **Layout change** | If AIChat component persists in tree (not remounted), subscription stays active. If remounted, fresh subscription reads latest state. |

---

## Implementation Details

### 1. ChatService: Session State

```ts
interface InternalSession {
  state: SessionState
  abortController: AbortController | null
  approvalId: string | null
  lastSavedSnapshot: string
  listeners: Set<(state: SessionState) => void>
  saveTimer: ReturnType<typeof setTimeout> | null
}

interface SessionState {
  sessionId: string | null
  messages: UIMessage[]
  loading: boolean
  error: { message: string; redacted: string } | null
  currentStep: TextStreamPart<any> | null
  pendingApproval: { command: string; cwd: string } | null
}
```

### 2. ChatService: Init & Permanent Listener

```ts
let initCalled = false

export function init(subscribe: SubscribeFn) {
  if (initCalled) return
  initCalled = true

  subscribe((event: any) => {
    // Dispatch streaming events to the correct active stream
    if (event.type === 'ai-chat-delta') {
      const { requestId, part } = event.data || {}
      const handler = requestId ? activeStreams.get(requestId) : null
      if (handler) handler(part)
      return
    }
    // Handle other events (session changes, approvals)
    if (event.type === AppEvents.ACTIVE_SESSION_CHANGED) { ... }
    if (event.type === AppEvents.AI_APPROVAL_REQUEST) { ... }
  })
}
```

### 3. ChatService: Stream Dispatch

```ts
const activeStreams = new Map<string, (part: any) => void>()

export function registerStreamHandler(
  requestId: string,
  handler: (part: any) => void,
): void {
  activeStreams.set(requestId, handler)
}

export function unregisterStreamHandler(requestId: string): void {
  activeStreams.delete(requestId)
}
```

### 4. runAgentLoop: Using `registerStream`

```ts
export async function runAgentLoop(
  messages: UIMessage[],
  config: AgentLoopConfig,
  workspaceFolders: string[],
  onEvent: (event: TextStreamPart<any>) => void,
  activeFile: string,
  abortSignal: AbortSignal,
  registerStream: (requestId: string, handler: (part: any) => void) => () => void,
): Promise<UIMessage[]> {
  // ...
  return new Promise((fulfill, reject) => {
    window.aynite.aiChat({...})
      .then((res) => {
        const requestId = res.requestId
        const unsubscribe = registerStream(requestId, (part) => {
          // Process part directly (no type/requestId filtering needed)
          switch (part.type) {
            case 'text-delta': ...
            case 'tool-call': ...
            case 'finish': unsubscribe(); fulfill(...)
          }
        })
      })
  })
}
```

### 5. Thin React Wrapper

```ts
export function useAIChat() {
  const subscribeToAppEvents = useAppEventSubscriber()

  // Init ChatService once
  useEffect(() => { ChatService.init(subscribeToAppEvents) }, [])

  // Subscribe to session state
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [sessionState, setSessionState] = useState<SessionState>(...)

  useEffect(() => {
    if (!activeSessionId) return
    return ChatService.subscribe(activeSessionId, setSessionState)
  }, [activeSessionId])

  // Delegate actions
  const sendMessage = async (text: string) => {
    const id = activeSessionId || await ChatService.createNewSession()
    await ChatService.sendMessage(id, text)
  }

  return {
    messages: sessionState.messages,
    loading: sessionState.loading,
    sendMessage,
    // ... etc
  }
}
```

---

## File Reference Map

| File | Role |
|------|------|
| `src/renderer/views/aichat/services/ChatService.ts` | Module-level singleton — state, agent loops, auto-save, stream dispatch |
| `src/renderer/views/aichat/utils/agent.ts` | Pure utility — streaming loop, message accumulation, tool handling |
| `src/renderer/views/aichat/hooks/useAIChat.ts` | Thin React wrapper — subscribes to ChatService, delegates actions |
| `src/renderer/views/aichat/AIChat.tsx` | No changes — same interface from useAIChat |

---

## Future: Multi-Session Support

With this architecture, adding multi-session support is straightforward:

```tsx
// SessionsDashboard.tsx — watches all running sessions
function SessionsDashboard() {
  const [runningSessions, setRunningSessions] = useState<SessionState[]>([])

  useEffect(() => {
    return ChatService.subscribeToAll((allSessions) => {
      setRunningSessions(allSessions.filter(s => s.loading))
    })
  }, [])

  return runningSessions.map(s => (
    <SessionCard key={s.sessionId} state={s} />
  ))
}

// AIChat.tsx — targets a specific session
function AIChat({ sessionId }: { sessionId: string }) {
  const chatState = useAIChat(sessionId)  // subscribe to specific session
  // ...
}
```

The `subscribeToAll` method would be:
```ts
const allListeners = new Set<(sessions: SessionState[]) => void>()

export function subscribeToAll(cb: (sessions: SessionState[]) => void) {
  allListeners.add(cb)
  cb([...sessions.values()].map(s => ({ ...s.state })))
  return () => allListeners.delete(cb)
}
```

---

## Compliance with Communication Architecture (RFC-001)

| Rule | How ChatService complies |
|------|--------------------------|
| **No manual `window.addEventListener('message', ...)`** | Uses `useAppEventSubscriber()` bridge from ViewContext |
| **No hardcoded `'aynite:'` strings** | Uses `AppEvents` constants and the stripped event type from the subscriber |
| **Data fetching is direct** | Uses `window.aynite.getConfig()` etc. — no event-based data requests |
| **No `postMessage` to renderer** | Only reads events, never posts |
| **Views use `useAppEvent()` from ViewContext** | ChatService receives subscriber as injected dependency via `init()` |
