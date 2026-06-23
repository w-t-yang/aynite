# RFC-004: Unified Agent Engine with Hooks Architecture

**Status:** Implemented  
**Date:** 2026-06-23  
**Author:** Aynite Team

---

## Objective

Consolidate the agent loop infrastructure into a single, extensible entry point that serves
all session types (general GUI chat, messenger bots, and future flow sessions) without
duplicating tool assembly, logging, or session management logic.

---

## Problem: Proliferating Session Callers

Before this RFC, the agent loop infrastructure had two separate callers that independently
assembled tools, wired callbacks, and managed session persistence:

```
                ┌──────────────────────────────────────┐
                │          runAgentLoop()               │
                │  (shared streamText loop, callbacks)  │
                └──────────┬───────────────┬────────────┘
                           │               │
              ┌────────────▼───┐   ┌───────▼────────────┐
              │   aiChat()     │   │runMessengerAgent()  │
              │  (GUI/general) │   │ (messenger bot)    │
              │                │   │                    │
              │ - createTools  │   │ - createTools      │
              │ - filter tools │   │ - add get_messages │
              │ - onEvent→emit │   │ - add notify_user  │
              │ - onFinish log │   │ - autoApproveCmds  │
              │                │   │ - onEvent log      │
              │                │   │ - onFirstToolCall  │
              │                │   │ - onFinishStep save│
              └────────────────┘   └────────────────────┘
```

**Problems with this approach:**

1. **Duplicate tool assembly** — every caller calls `createTools()` and applies filtering
   independently.
2. **Scattered callbacks** — 7 named callbacks on `runAgentLoop()` (`onEvent`, `onFirstToolCall`,
   `onToolResult`, `onCommandOutput`, `onFinishStep`, `onStreamError`, `onFinish`) with
   overlapping concerns.
3. **Type-specific state in the engine** — `firstToolCallFired` flag tracked inside the
   shared loop, only used by messenger sessions.
4. **Duplicate session persistence** — messenger saves incrementally via `onFinishStep`,
   general sessions don't save at all during the loop.
5. **Duplication will repeat** — adding a flow session type would require yet another caller
   with the same boilerplate.

---

## Solution: Hooks + Unified Session Runner

### Architecture

```
                    ┌──────────────────────────────────┐
                    │       runAgentSession()          │
                    │  (single entry point for all     │
                    │   session types)                 │
                    │                                  │
                    │  - creates tools                 │
                    │  - filters by session type       │
                    │  - merges extra tools            │
                    │  - internal hooks (log + save)   │
                    │  - merges caller hooks           │
                    │  - delegates to runAgentLoop()   │
                    └──────────────┬───────────────────┘
                                   │
                    ┌──────────────▼───────────────────┐
                    │         runAgentLoop()           │
                    │  (low-level streamText loop)     │
                    │                                  │
                    │  - no named callbacks            │
                    │  - only hooks: Partial<Hooks>    │
                    │  - no firstToolCallFired         │
                    └──────────────────────────────────┘
                                   │
                  ┌────────────────┼────────────────┐
                  │                │                │
     ┌────────────▼───┐  ┌────────▼───────┐  ┌─────▼──────┐
     │  aiChat()      │  │handleChatMsg() │  │ flow*       │
     │ (general)      │  │ (messenger)    │  │ (future)    │
     │                │  │                │  │             │
     │ thin setup     │  │ thin setup     │  │ thin setup  │
     │ + hooks→emit   │  │ + extraTools   │  │             │
     └────────────────┘  └────────────────┘  └─────────────┘
     * Not yet implemented
```

### Hook Typed Events

The engine defines 10 typed hook points. Each fires with a typed payload containing only
the data relevant to that point:

```ts
interface AgentHooks {
  'step-start':      (event: { step: number }) => void
  'text-delta':      (event: { text: string }) => void
  'reasoning-delta': (event: { text: string }) => void
  'tool-call':       (event: { toolCallId: string; toolName: string; args: any }) => void
  'tool-result':     (event: { toolCallId: string; toolName: string; input: any; output: any }) => void
  'command-output':  (event: { text: string }) => void
  'step-finish':     (event: { messages: UIMessage[] }) => void
  'error':           (event: { error: string }) => void
  'finish':          (event: { messages: UIMessage[]; text: string; reasoning: string; toolCalls: any[] }) => void
}
```

Key principles:
- **No type-specific callbacks** — no `onFirstToolCall`, no `onStreamError`. All behavior
  is expressed through hooks.
- **No caller state in the engine** — `firstToolCallFired` is gone. Callers track their own
  first-call state if they need it.
- **Rich payloads** — `'step-finish'` and `'finish'` include `messages: UIMessage[]` so
  incremental save hooks can write to disk without needing closure access to loop state.

### Hook Merging

`runAgentSession()` builds internal hooks (consistent logging + incremental save) and merges
them with caller-provided hooks. All handlers fire in order (internal first, caller second):

```ts
const merged = mergeHooks(internalHooks, callerHooks)
```

The `mergeHooks()` helper collects all handlers for each hook key and wraps them in a single
async function that calls each handler in sequence:

```ts
export function mergeHooks(...hooksList: (Partial<AgentHooks> | undefined)[]): Partial<AgentHooks> | undefined {
  // For each key, collect all handlers and fire them in order
  (result as any)[key] = async (event: any) => {
    for (const handler of handlers) {
      await handler(event)
    }
  }
}
```

### Internal Hooks (built into `runAgentSession()`)

```ts
const prefix = `[Agent ${session.type}/${session.id}]`

const internalHooks = {
  'step-start': ({ step }) => console.log(`${prefix} step ${step} started`),
  'tool-call': ({ toolName, toolCallId }) => console.log(`${prefix} tool-call: ${toolName} (id: ${toolCallId})`),
  'tool-result': ({ toolName, output }) => console.log(`${prefix} tool-result: ${toolName} (${preview})`),
  'command-output': ({ text }) => console.log(`${prefix} command-output: ${text.slice(0, 100)}`),
  'error': ({ error }) => console.error(`${prefix} stream error: ${error}`),
  'step-finish': async ({ messages }) => {
    await writeJson(path.join(session.dir, 'messages.json'), messages)
  },
  'finish': ({ text, reasoning, toolCalls }) => console.log(`${prefix} finished: text=${text.length} chars, ...`),
}
```

These fire for ALL session types — every session gets consistent logging format and
automatic incremental saves.

---

## Implementation

### Files Changed

| File | Change |
|------|--------|
| `src/main/ai/agent-engine.ts` | Refactored `runAgentLoop()` to use hooks, added `runAgentSession()` and `mergeHooks()` |
| `src/main/ai/chat.ts` | Simplified `aiChat()` to call `runAgentSession()` instead of assembling tools + calling `runAgentLoop()` |
| `src/main/messengers/shared.ts` | Removed `runMessengerAgent()`, refactored `handleChatMessage()` to call `runAgentSession()` directly |

### Line Count Impact

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| `agent-engine.ts` | 209 lines | ~250 lines | +41 (added `runAgentSession` + `mergeHooks`) |
| `chat.ts` (aiChat only) | ~70 lines | ~55 lines | -15 |
| `shared.ts` (runMessengerAgent) | ~110 lines | 0 lines | -110 |
| **Total** | **~389 lines** | **~305 lines** | **-84 lines** |

### Caller Simplification

**Before (aiChat — 70 lines of setup + loop):**
```ts
const cachedTools = createTools(toolContext)
const enabledTools = filterTools(cachedTools, config.enabledTools, sessionType)
emit('start', ...)
const result = await runAgentLoop({ messages, config, tools: enabledTools, ..., onEvent, onFinish })
```

**After (aiChat — 40 lines, pure setup):**
```ts
const sessionDir = getSessionDir(sessionId, workspaceName)
await runAgentSession({
  messages, config, providerOptions,
  session: { id: sessionId, type: sessionType || 'general', dir: sessionDir },
  toolContext: { workspaceFolders, activeFile, workspaceName },
  enabledTools: config.enabledTools,
  hooks: { 'step-start': (e) => emit({ type: 'start', step: e.step }), ... },
})
```

**Before (messenger — runMessengerAgent was 110 lines):**
```ts
const tools = createTools(toolContext)
tools.get_messages = createGetMessagesTool(...)
tools.notify_user = createNotifyUserTool(...)
const result = await runAgentLoop({ ..., onEvent, onFirstToolCall, onCommandOutput, onFinishStep })
```

**After (messenger — inlined into handleChatMessage, ~30 lines):**
```ts
const result = await runAgentSession({
  messages: updatedMessages, config: activeProvider,
  session: { id: sessionId, type: 'messenger', dir: getBotSessionDir(...) },
  toolContext: { workspaceFolders, autoApproveCommands: true },
  extraTools: { get_messages: getMessagesTool, notify_user: notifyUserTool },
  hooks: { 'tool-call': () => { if (!firstToolCallFired) { ...; ctx.reply(...) } } },
})
```

---

## Trade-offs & Rationale

### 1. Hooks vs. Event Emitter Pattern

**Chosen: Hooks (typed interfaces per event type).**  
**Rejected: Single generic `onEvent` callback with discriminated union.**

Rationale: Hooks give TypeScript precise payload types per event. A single `onEvent` callback
with a union type requires narrowing in every handler. Hooks also make `mergeHooks()` trivial —
just collect handlers per key.

### 2. Internal hooks bundled inside `runAgentSession()` vs. injected by callers

**Chosen: Internal hooks are built inside `runAgentSession()`** with caller hooks merged on top.
**Rejected: Requiring every caller to set up logging + save hooks themselves.**

Rationale: Logging and incremental save should be consistent across all session types. If every
caller had to set these up, we'd risk inconsistency or missing saves. By baking them in and
merging caller hooks on top, we guarantee consistency while preserving extensibility.

### 3. `'step-finish'` includes `messages` vs. callers tracking their own state

**Chosen: `'step-finish'` payload includes `messages: UIMessage[]`.**  
**Rejected: Callers using closures to access loop state.**

Rationale: The loop manages `loopMessages` internally. Exposing `messages` in the
`'step-finish'` hook avoids callers needing to reach into the engine's internal state or
maintain their own copy. This also makes the hook self-contained — the handler doesn't
need any closure references to the running loop.

### 4. `mergeHooks()` fires all handlers vs. last-write-wins

**Chosen: All handlers fire in order (internal first, caller second).**  
**Rejected: Caller hooks replace internal hooks.**

Rationale: The internal hooks (logging, save) are important infrastructure. Callers should
add behavior on top, not suppress it. If a caller needs to suppress logging, they can pass
a no-op or modify the hooks directly.

### 5. Session type as parameter vs. separate functions

**Chosen: `session.type: 'general' | 'messenger' | 'flow'`** as a parameter.
**Rejected: Separate functions like `runGeneralSession()`, `runMessengerSession()`.**

Rationale: A single function with a type parameter is simpler to maintain, test, and extend.
`getEnabledToolsForSession()` already uses the type to auto-enable group-specific tools
(messenger tools for messenger sessions, flow tools for flow sessions).

---

## Adding a New Session Type (e.g., Flows)

To add a new session type, future developers would:

1. **Add the type string** to the union in `AgentSessionOptions.session.type`
2. **Add the tool group** to `SYSTEM_TOOL_GROUPS` in constants
3. **Add tool metadata** to `TOOL_METADATA` with the new group
4. **Create a caller** that calls `runAgentSession()` with the new session type, appropriate
   tool context, and any type-specific hooks
5. No changes needed to `runAgentLoop()` or `runAgentSession()` internals

Example flow caller:

```ts
async function runFlowSession(flowId: string, steps: FlowStep[]) {
  // ... load config, build messages, compute dir
  return runAgentSession({
    messages,
    config: activeProvider,
    session: { id: flowId, type: 'flow', dir: flowDir },
    toolContext: { workspaceFolders, autoApproveCommands: true },
    extraTools: { create_steps: createStepsTool },
    hooks: { 'finish': ({ messages }) => saveExecutionResult(flowId, messages) },
  })
}
```

---

## Future Considerations

| Direction | Notes |
|-----------|-------|
| **Renaming callers** | `aiChat()` and `handleChatMessage()` could be renamed to `runGeneralSession()` and `runMessengerSession()` for naming consistency. |
| **Flow session type** | Directly supported by the current architecture — see example above. |
| **Per-step hooks** | If needed, `'step-start'` could receive additional context like the current `toolCalls` or step number for finer-grained control. |
| **Hook priority** | If some callers need to override internal hooks (e.g., suppress logging in testing), we could add a priority or override mechanism to `mergeHooks()`. |
| **async hooks** | All hooks are currently `void`. If async hooks become common (like the save hook already is), the engine should `await` them properly (already done for `'step-finish'`). |
