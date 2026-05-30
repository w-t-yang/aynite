# WorkspaceView — Dependencies

## Context Providers

| Provider | Functions Used | Purpose |
|----------|---------------|---------|
| **Bridge: config** | `config.get('activeWorkspace')`, `config.get('activeSessionId')` | Load workspace name, active session |
| **Bridge: configMutations** | `configMutations.set('activeSessionId', ...)`, `configMutations.set('session-delete', ...)` | Select/delete sessions |
| **Bridge: ai** | `aiBridge.listSessions()`, `aiBridge.getArtifactsStatus()` | Load session list, get artifact info |
| **Bridge: file** | `bridgeFile.list(dir)` | List files in artifacts directory |
| **Bridge: workspace** | `workspace.folders()` | Get workspace folder list |

## Events (via `useViewEvent`)

| Event | Payload | Handler |
|-------|---------|---------|
| `active-session-changed` | `{ id: string }` | Updates active session ID |
| `config-changed` | _none_ | Reloads all workspace data and artifacts |
| `session-deleted` | _none_ | Reloads session list |
| `session-saved` | _none_ | Reloads session list and artifacts |

## Description

Workspace home view showing folders (via GitDiffView), workspace artifacts (files from memory.md directory), and session list. Sessions can be selected (switches AI Chat session) or deleted.
