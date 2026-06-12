# GitDiffView (shared/featured) — Dependencies

## Context Providers

Uses `git` and `gitMutations` from `../../bridge/git`:
- `git.checkIsRoot` — check if a folder is a git root
- `git.getStatus` / `git.refreshStatus` — get or refresh git status for a folder
- `git.getDiffStats` — get diff stats (additions/deletions per file)
- `gitMutations.commitGenerate` — generate commit message via AI
- `gitMutations.commitExecute` — execute the commit (git add -A + git commit)

## Events (via `useViewEvent`)

| Event | Payload | Handler |
|-------|---------|---------|
| `git-status-changed` | `{ root: string }` | Re-fetches git status for all tracked folders |

## Description

Shared component that displays git changes for workspace folders. Used by both Treeview (changes-only mode) and WorkspaceView. Supports commit generation and execution. Uses typed bridge API (`git`/`gitMutations`) for all operations.
