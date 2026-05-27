# Aynite Keybinding System Rules

This document outlines the architecture and mandatory rules for keyboard event management in Aynite.

## 1. Core Architecture: Centralized Delegation

Aynite uses a **Singleton KeyManager** (`src/renderer/src/lib/key-handlers.ts`) that serves as the single source of truth for all keyboard events.

### The Flow:
1. **Global Listener**: `KeyManager` attaches a single `keydown` and `keyup` listener to the `window` during the capture phase (`true`).
2. **Global Shortcuts**: The manager first checks for global app-wide shortcuts (Save, Reload, Panel Toggles).
3. **Context Detection**: If no global shortcut matches, the manager determines the **Active Component Context** based on `document.activeElement` and its proximity to specific CSS class markers:
   - `.chat-input-wrapper` -> `chat` context
   - `.settings-panel` -> `settings` context
   - `.sidebar-container` -> `sidebar` context
   - `.file-viewer-search` -> `editor` context (search mode)
   - Otherwise -> `editor` context
4. **Functional Delegation**: The manager delegates the event to a high-level **API** provided by the active component.

---

## 2. Mandatory Rules for Components

To maintain consistency and prevent input conflicts, all components **MUST** follow these rules:

### Rule 1: No Local Listeners
- **Forbidden**: `window.addEventListener('keydown', ...)`
- **Forbidden**: `<div onKeyDown={...}>`
- **Forbidden**: `document.onkeyup = ...`

### Rule 2: Register an Action-Based API
If a component needs to respond to keys, it must define an API interface in `key-handlers.ts` and register it on mount. The API methods should be high-level (e.g., `moveSelection`, `confirm`) and **MUST NOT** take a `KeyboardEvent` as an argument.

### Rule 3: Use CSS Class Markers
Components must wrap their root or specific input areas with identification classes (e.g., `.sidebar-container`) so the `KeyManager` can accurately detect the context.

---

## 3. Validation Instructions

To ensure the keybinding architecture remains clean, run these checks periodically:

### Check for Illegal Listeners
Run this grep command to find any component that is listening to keys directly:
```bash
grep -rE "onKeyDown|onKeyUp|onKeyPress|addEventListener\(['\"]key" src/renderer/src/components
```
**Allowed Exceptions**:
- `UnifiedViewer.tsx` (Bridge proxy for iframes).
- Generic input `onChange` or `onBlur` (not key events).

### Verification Checklist for New Components
When adding a new component that needs keyboard support:
1. [ ] Add a new context name (if needed) to `KeyManager`.
2. [ ] Define a `ComponentAPI` interface in `key-handlers.ts`.
3. [ ] Implement the API in your component.
4. [ ] Call `KeyManager.registerComponent(api)` in a `useEffect` on mount.
5. [ ] Add a unique CSS class to your component's container for context detection.
6. [ ] Update `KeyManager.handleGlobalKeyDown` to delegate to your new API.

---

## 4. Troubleshooting

- **Key is not reaching my component**: Ensure the component (or its input) is focused, or that it is correctly identified by the `context` detection logic in `KeyManager`.
- **Shortcut is blocked**: Check if a higher-priority Global Shortcut in `KeyManager` is matching the key and calling `preventDefault()`.
