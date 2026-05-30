# GitDiffView (shared/featured) — Dependencies

## Context Providers

Uses `window.aynite.checkIsGitRoot`, `window.aynite.getGitStatus`, `window.aynite.refreshGitStatus`, `window.aynite.getGitDiffStats`, `window.aynite.commitGenerate`, `window.aynite.commitExecute` directly
(bypasses typed bridge — uses raw `window.aynite` preload API).

## Events (via `useViewEvent`)

| Event | Payload | Handler |
|-------|---------|---------|
| `git-status-changed` | `{ root: string }` | Re-fetches git status for all tracked folders |

## Description

Shared component that displays git changes for workspace folders. Used by both Treeview (changes-only mode) and WorkspaceView. Supports commit generation and execution. Note: accesses `window.aynite` directly rather than through typed bridge — legacy pattern.
