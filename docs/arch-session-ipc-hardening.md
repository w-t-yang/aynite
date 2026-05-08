# Session Summary: Hub-and-Spoke IPC & Theme Hardening
Date: 2026-05-08

## 1. Architectural Objective
The goal was to streamline and secure the application's Hub-and-Spoke IPC architecture by enforcing strict architectural boundaries and automating compliance checks. This prevents "ad-hoc" communication protocols and ensures a single source of truth for events and themes.

## 2. The Hub-and-Spoke Model
- **Hub (AppContext)**: Located at `src/renderer/src/AppContext.tsx`. The exclusive authority for broadcasting system events to iframes via `postMessage`.
- **Spokes (Views)**: Governed by `ViewContext.tsx`. 
    - **Direct IPC**: Views use `window.aynite` for data fetching (getTheme, getConfig, openFile).
    - **Event Consumption**: Views use `useAppEvent` or `useAppEventSubscriber` to listen for relayed events.
    - **Styling**: Views apply themes internally via CSS variables; parent-to-iframe injection is deprecated.

## 3. Automated Safeguards (Strict Mode)
We implemented a suite of audit scripts to enforce these rules:
- `npm run audit:event`: Blocks manual `postMessage` outside the Hub and forbids hardcoded event strings.
- `npm run audit:theme`: Forbids hardcoded colors in views and requires usage of the standardized `setTheme` hook.
- `npm run audit:types`: Enforces type isolation by moving shared types to `src/lib/types/`.

## 4. Key Refactorings
- **UnifiedViewer.tsx**: Stripped of legacy CSS injection logic.
- **AIChat.tsx**: Refactored to remove illegal `AppContext` dependencies, now uses `useAppEventSubscriber` for agent loops.
- **ViewContext.tsx**: Expanded with `useAppEventSubscriber` to support non-React async listeners.
- **Preload Bridge**: Restored missing theme APIs and fixed a critical channel name mismatch (`GET` -> `READ`).

## 5. Status
- ✅ All architectural audits pass.
- ✅ Views build and deploy successfully.
- ✅ Theme synchronization is fully reactive across shell and iframes.

## 6. Pick Up Next Time
- Ensure all new features follow the `useAppEvent` pattern.
- Maintain `npm run audit:base` as the gatekeeper for architectural integrity.
