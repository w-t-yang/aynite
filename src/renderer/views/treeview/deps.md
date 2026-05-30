# Treeview — Dependencies

## Context Providers

| Provider | Functions Used | Purpose |
|----------|---------------|---------|
| **Bridge: config** | `config.get('activeFile')` | Load initial active file for tree expansion |
| **Bridge: configMutations** | `configMutations.set('activeFile', ...)` | Set active file on selection |
| **Bridge: fileMutations** | `fileMutations.create(path, isDir)`, `fileMutations.rename(old, new)`, `fileMutations.delete(path)`, `fileMutations.copy(src, dest)` | File CRUD operations from context menu |
| **Bridge: workspace** | `workspace.list()`, `workspace.folders()` | List workspaces and their folders |
| **Bridge: workspaceMutations** | `workspaceMutations.switch(ws)`, `workspaceMutations.create(name)`, `workspaceMutations.addFolder()`, `workspaceMutations.removeFolder(path)`, `workspaceMutations.reorderFolders(order)` | Workspace management and folder CRUD |
| **Bridge: utils** | `utils.dirname(path)`, `utils.joinPath(...)` | Path manipulation for file operations |

## Hooks

| Hook | Purpose |
|------|---------|
| `useGitStatus` | Tracks git status for all workspace folders, fetches on demand |

## Events (via `useViewEvent` — in Treeview and useGitStatus)

| Source | Event | Payload | Handler |
|--------|-------|---------|---------|
| **Treeview** | `active-file-changed` | `{ path: string }` | Sets active file path for tree expansion |
| **Treeview** | `fs-change` | `{ event: string, path: string }` | Refreshes file tree and git status for affected folders |
| **useGitStatus** | `git-status-changed` | `{ root: string, status: GitStatusMap }` | Merges new git status data into state |

## Description

File tree explorer with workspaces, drag-and-drop, context menu (create/rename/delete/copy/paste), git status indicators, and changes-only mode. Uses react-arborist for virtualized tree rendering.
