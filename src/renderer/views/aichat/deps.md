# AIChat — Dependencies

## Context Providers

| Provider | Functions Used | Purpose |
|----------|---------------|---------|
| **Bridge: config** | `config.get('activeSessionId')`, `config.get('ai')`, `config.get('agents')`, `config.get('tools')`, `config.get('prompts')` | Load initial session, settings, providers, agents, tools, prompts |
| **Bridge: configMutations** | `configMutations.set('activeSessionId', ...)`, `configMutations.set('agents', ...)`, `configMutations.set('ai', ...)` | Persist session ID, switch agent/provider |
| **Bridge: ai** | `aiBridge.listSessions()`, `aiBridge.getArtifactsStatus()` | Load session list for history modal, get artifact status |
| **Bridge: aiMutations** | `aiMutations.saveSession()` (via ChatService) | Save session messages to disk |
| **Bridge: workspace** | `workspace.folders()`, `workspace.allFiles()` | Get workspace folders for file access in chat |
| **Bridge: utils** | `utils.writeClipboard(text)` | Copy chat content to clipboard |
| **Bridge: events** | `events.execute('SETTINGS', ...)` | Open AI settings |
| **Bridge: fileMutations** | `fileMutations.open(path)` | Open file from chat message |
| **Bridge: spells** | `spells.getAvailableSkills()`, `spells.getAvailableCommands()` | Get available skills/commands for @mention completion |
| **ChatService** (singleton) | `init()`, `subscribe()`, `sendMessage()`, `clearChat()`, `loadSessionById()`, `createNewSession()`, `handleApprove()`, `handleReject()`, `revertToMessage()`, `abortMessage()`, `clearError()`, `hasSession()` | All agent loop state, session persistence |

## Events (via `useViewEventSubscriber` → ChatService)

| Event | Payload | Handler |
|-------|---------|---------|
| `config-changed` | _none_ | Reloads settings (AI, agents, tools, prompts) |
| `workspace-changed` | _none_ | Reloads workspace folders |
| `active-tab-changed` | `{ path: string }` | Tracks active tab path for chat context |
| `active-session-changed` | `{ id: string }` | Switches active session, loads from disk if new |

## Events (ChatService internal, via `useViewEventSubscriber`)

| Event | Payload | Handler |
|-------|---------|---------|
| `ai-chat-delta` | `{ requestId, part }` | Dispatches streaming deltas to active stream handler |
| `active-session-changed` | `{ id: string }` | Loads session from disk if not in memory |
| `ai-approval-request` | `{ id, command, cwd }` | Sets pending approval state on loading session |

## Description

Heaviest view — full AI chat interface with agent loop, streaming, session management, and tool calling. Uses a module-level singleton (ChatService) that survives React unmounts/remounts. The `useAIChat` hook is a thin React wrapper over ChatService, handling only UI-level state.
