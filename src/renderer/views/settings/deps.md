# Settings — Dependencies

## Context Providers

| Provider | Functions Used | Purpose |
|----------|---------------|---------|
| **ViewContext** (via `useView`) | `themes`, `activeThemeId`, `setTheme()` | Get current theme state, switch themes |
| **Bridge: config** | `config.get('ai')`, `config.get('agents')`, `config.get('prompts')`, `config.get('keybindings')`, `config.get('skills')`, `config.get('commands')`, `config.get('tools')`, `config.get('version')` | Load all settings on mount |
| **Bridge: configMutations** | `configMutations.set(...)` all config keys | Persist settings changes |
| **Bridge: ai** | `aiBridge.getMergedSystemPrompt(...)` | Load merged prompt for active agent |
| **Bridge: aiMutations** | `aiMutations.restorePrompts()` | Restore prompts to defaults |
| **Bridge: spells** | `spells.getAvailableSkills()`, `spells.getAvailableCommands()` | List available skills/commands |
| **Bridge: spellsMutations** | `spellsMutations.pickSkillFolder()`, `spellsMutations.pickCommandFolder()`, `spellsMutations.restoreSkills()`, `spellsMutations.restoreCommands()` | Manage skill/command folders, restore defaults |
| **Bridge: system** | `bridgeSystem.getSystemFonts()`, `bridgeSystem.selectFile(...)` | Get system fonts, pick prompt file |
| **Bridge: systemMutations** | `systemMutations.openExternal(url)` | Open external links in About tab |
| **Bridge: updateMutations** | `updateMutations.check()`, `updateMutations.download()`, `updateMutations.install()` | App update lifecycle |

## Events (via `useViewEvent` — in AboutTab)

| Event | Payload | Handler |
|-------|---------|---------|
| `update-checking` | _none_ | Sets update status to 'checking' |
| `update-available` | `{ version: string }` | Sets update status to 'available' |
| `update-not-available` | _none_ | Resets to 'idle' |
| `update-downloading` | _none_ | Sets status to 'downloading' |
| `update-download-progress` | `{ percent: number }` | Updates download progress |
| `update-downloaded` | `{ version: string }` | Sets status to 'downloaded' |
| `update-error` | `{ message: string }` | Sets status to 'error' |

## Sub-tabs

| Tab | Component | Purpose |
|-----|-----------|---------|
| Appearance | `AppearanceTab` | Theme selection, font settings |
| Keybindings | `KeybindingsTab` | Keyboard shortcut configuration |
| AI | `AITab` | AI provider configuration (Ollama, OpenAI, etc.) |
| Agents | `AgentsTab` | Agent configuration with prompt files |
| Tools | `ToolsTab` | Enable/disable AI tools |
| Skills | `SkillsTab` | Skill folder management |
| Commands | `CommandsTab` | Command folder management |
| About | `AboutTab` | App version, update management, links |

## Description

Settings panel with 8 tabs in a sidebar layout. The most data-heavy view — loads 9+ config keys on mount. Each tab manages its own slice of state and persists via `configMutations.set()`. The AboutTab also handles the full update lifecycle (check, download, install) via relayed events.
