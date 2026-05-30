/**
 * Bridge Layer — Typed interface to Electron IPC
 *
 * This is the ONLY code in the renderer that accesses `window.aynite`.
 * All renderer code (contexts, views, services) imports from this bridge.
 *
 * Each domain module exports:
 *   - `domainName` — getter functions (return Promise<T>)
 *   - `domainNameMutations` — setter functions (return Promise<void>)
 *
 * Setters return Promise<void> to enforce the event-driven state update pattern.
 * State changes come through bridge.events.onAppEvent, not from setter return values.
 *
 * Architecture:
 *   bridge → context providers → useApp() hooks → components/views
 *   bridge → views (direct imports for imperative operations)
 */

export { ai, aiMutations, aiStream } from './ai'
export type { ConfigSchema } from './config'

// Domain modules
export { config, configMutations } from './config'
// Events (special — setup in AppContext only)
export { events, isAvailable } from './events'
export { file, fileMutations, legacyFile } from './file'
export { git, gitMutations } from './git'
export { rss, rssMutations } from './rss'
export { spells, spellsMutations } from './spells'
export { spotify, spotifyMutations } from './spotify'

export { system, systemMutations } from './system'
export { theme, themeLegacy, themeMutations } from './theme'
export { updateMutations } from './update'
export { platform, utils } from './utils'
export { workspace, workspaceMutations } from './workspace'
