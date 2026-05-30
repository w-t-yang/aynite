# View Debug Skill

A skill for AI agents to identify and fix bugs in Aynite's iframe view layer.

## When to Use

Any bug report involving a view (iframe-based micro-frontend in `src/renderer/views/`):
- View not responding to events
- View showing stale data
- View crashing on mount
- View not updating after state changes
- View import errors or undefined behavior

## Investigation Protocol

### Step 0: Read with a grain of salt

The `deps.md`, RFCs (`rfc/003-bridge-architecture.md`, `rfc/003-refactor-summary.md`), and `scripts/audit-bridge-architecture.ts` are **living documents** — they may be wrong, outdated, or incomplete.

Treat them as **helpful guides**, not ground truth:
- The `deps.md` may have missing or incorrect dependency/event listings
- The RFCs document the ideal architecture — the actual code may have drifted
- The audit script may have false positives/negatives or miss patterns

**Use your best judgment.** If something seems wrong, investigate the actual code to confirm. If you find a better way, an improvement, or anything that simplifies the architecture:
- Fix the code
- Fix the `deps.md`
- Fix the RFC or audit script

Don't blindly follow outdated docs — improve them.

### Step 1: Read the dependency documentation

Every view directory has a `deps.md` file. Read it first to understand:

```markdown
src/renderer/views/<view-name>/deps.md
```

The `deps.md` tells you:
- **Context providers** — which bridge modules the view uses and for what purpose
- **Events** — which relayed events the view subscribes to and how it handles them

If the `deps.md` does not exist, the view has not been documented yet. Create one as part of the fix.

### Step 2: Read the architecture RFCs

Two RFCs define the architectural rules:

```
rfc/003-bridge-architecture.md    — Full architecture spec (getter/setter split, event routing, dependency rules)
rfc/003-refactor-summary.md       — Migration summary + audit results + remaining work
```

Key concepts to understand:
- **Getter/setter split**: Getters return `Promise<T>`, setters return `Promise<void>`
- **Single event router**: AppContext has ONE `events.onAppEvent`, ViewContext has ONE `postMessage` listener per iframe
- **Views consume state, not events**: Views should use `useViewEvent()` from `./useViewEvents`, not raw `postMessage` listeners

### Step 3: Run the audit

```bash
npx tsx scripts/audit-bridge-architecture.ts
```

The audit enforces 6 rules:

| Rule | Check | Meaning |
|------|-------|---------|
| RULE-1 | No `window.aynite` outside bridge/ | All IPC must go through typed bridge |
| RULE-2 | No bridge imports in shared/ | Shared components use `useApp()` hooks |
| RULE-3 | No `useAppEvent`/`useAppEventSubscriber` from ViewContext | Views must import from `./useViewEvents` |
| RULE-4 | One `onAppEvent` listener (AppContext only) | No context provider sets up its own listener |
| RULE-5 | postMessage listeners only in ViewContext/useViewEvents | No raw `addEventListener('message')` in views |
| RULE-6 | No raw `window.aynite.onAppEvent` | Must go through `bridge.events` |

### Step 4: Classify the bug

Determine if the bug is an **architectural violation** or a **logic bug**:

#### Architectural Violation

The bug is caused by code that violates the bridge architecture:

| Pattern | Problem | Fix |
|---------|---------|-----|
| `window.aynite.someMethod()` in a view | Direct preload access — bypasses typed bridge | Replace with `bridge.someModule.someMethod()` |
| `useAppEvent('some-event', handler)` in a view | Deprecated import from ViewContext | Replace with `useViewEvent('some-event', handler)` from `./useViewEvents` |
| `addEventListener('message', handler)` in a view | Raw message listener — bypasses ViewContext routing | Replace with `useViewEvent()` or `useViewEventSubscriber()` |
| `await bridge.someMutations.set(key, val)` then immediately `await bridge.someModule.get(key)` | Read-after-set — ignores the event loop contract | Remove the get() call. The event will bring the updated state. |
| `await someSetter()` returning a value instead of `void` | Setter returns data — caller assumes immediate consistency | Make setter return `Promise<void>`, handle state updates via events |
| Missing `import { useViewEvent } from '../useViewEvents'` | Direct import from wrong path | Fix the import path |

#### Logic Bug

The cause is a runtime error in the business logic (not an architecture violation):

| Pattern | Problem | Fix |
|---------|---------|-----|
| `Cannot read properties of undefined` | Bridge module not imported or `window.aynite` undefined | Check the import, add bridge guard |
| View not updating after setter call | The setter fires but the event hasn't been handled | Verify the event is listed in `deps.md` and subscribed in the view |
| Stale data in view | View caches data locally but doesn't re-fetch on events | Add the relevant `useViewEvent()` subscription |
| TypeScript errors | Wrong types, missing imports | Check the bridge module signature |

### Step 5: Fix the bug

Apply the fix concisely:

1. **Fix the root cause** — surgical edit, minimal lines changed
2. **Verify with the audit** — run `npx tsx scripts/audit-bridge-architecture.ts`
3. **Verify types** — run `npx tsc --noEmit` to check for type errors

### Step 6: Improve the architecture documentation

After fixing, update the documentation to prevent this bug from recurring:

1. **Update `deps.md`** — if the view was missing event subscriptions in its deps file, add them
2. **Update `scripts/audit-bridge-architecture.ts`** — if the audit missed a pattern, add a check
3. **Update `rfc/003-refactor-summary.md`** — if the fix reveals a gap in the architecture spec, add a note

## Common Bug Patterns and Fixes

### Bug: View crashes with "Cannot read properties of undefined (reading 'getConfig')"

**Root cause:** The view accesses `window.aynite` directly but the bridge layer hasn't been imported, or the view is running outside Electron (e.g., in a browser for testing).

**Fix:**
```typescript
// ❌ BAD
const data = await window.aynite.getConfig('someKey')

// ✅ GOOD
import { config } from '../../bridge/config'
const data = await config.get('someKey')
```

**Update deps.md:** Ensure the bridge import is listed in the Context Providers table.

### Bug: View shows stale data after a setter call

**Root cause:** The view calls a setter (e.g., `configMutations.set('activeFile', path)`) and expects its local state to be immediately updated. But the setter returns `Promise<void>` — the update comes later through the event loop.

**Fix:** Add a `useViewEvent()` subscription to react to the state change:

```typescript
// ❌ BAD — assumes immediate consistency
await configMutations.set('activeFile', path)
console.log(activePath) // still the OLD path

// ✅ GOOD — react to the event
useViewEvent('active-file-changed', (data: { path: string }) => {
  setActivePath(data.path)
})
```

**Update deps.md:** Add the event to the Events table.

### Bug: View has multiple postMessage listeners causing duplicate renders

**Root cause:** The view calls `addEventListener('message', handler)` directly AND also uses `useViewEvent()` for the same event.

**Fix:** Remove the raw `addEventListener` and use only `useViewEvent()`:

```typescript
// ❌ BAD — duplicate listener
useEffect(() => {
  window.addEventListener('message', handler)
  return () => window.removeEventListener('message', handler)
}, [])
useViewEvent('some-event', anotherHandler)

// ✅ GOOD — single listener via hook
useViewEvent('some-event', handler)
```

### Bug: Import path errors after refactoring

**Root cause:** The view imports from `../ViewContext` for `useAppEvent`/`useAppEventSubscriber` but these are now re-exports from `./useViewEvents`.

**Fix:**
```typescript
// ❌ BAD — deprecated import
import { useAppEvent } from '../ViewContext'

// ✅ GOOD — proper import
import { useViewEvent } from '../useViewEvents'
```

**Note:** `useAppEvent` and `useAppEventSubscriber` still exist as deprecated re-exports from `ViewContext` for backward compatibility. They will be removed in a future release. Always use `useViewEvent` and `useViewEventSubscriber` from `./useViewEvents` instead.

### Bug: Setter returning a value instead of void

**Root cause:** A bridge mutation function returns data (e.g., `createNewSession` returns the session ID), creating a false sense of immediate consistency.

**Fix:** The setter should return `Promise<void>`. The return value should come through the event loop instead. If the caller needs the value (like a new session ID), the caller should generate it before calling the setter:

```typescript
// ❌ BAD — setter returns data
export const aiMutations = {
  saveSession: (id: string, messages: any[]): Promise<string> => {
    return getAynite().saveSession(id, messages)
  }
}

// ✅ GOOD — caller generates the ID, setter returns void
// In ChatService:
const newId = Date.now().toString()
await aiMutations.saveSession(newId, [])
// Use newId locally — no need to read it from the setter
```

## Verification Checklist

After fixing a bug, verify:

- [ ] `npx tsx scripts/audit-bridge-architecture.ts` — 0 violations
- [ ] `npx tsc --noEmit` — no type errors in the view's files
- [ ] The `deps.md` for the view is accurate (bridge deps + events)
- [ ] If the fix revealed a gap in the audit script, update it
- [ ] If the fix reveals a missing pattern in the RFC, document it
