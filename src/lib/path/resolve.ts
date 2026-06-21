/**
 * Path resolution functions — pure, synchronous, no I/O.
 *
 * All functions here just compute paths. They don't read or write files.
 * This is the only module in src/lib/path/ that can be tested without mocks.
 */
import { homedir } from 'node:os'
import path from 'node:path'
import { AYNITE_SUBDIRS } from '../constants/path'

export { AYNITE_SUBDIRS }

const AYNITE_DIR = path.join(homedir(), '.aynite')

export function getAyniteDir() {
  return AYNITE_DIR
}

export function getAynitePath(...parts: string[]) {
  return path.join(AYNITE_DIR, ...parts)
}

export function getAyniteConfigDir() {
  return path.join(AYNITE_DIR, AYNITE_SUBDIRS.CONFIG)
}

export function getAyniteLogsDir() {
  return path.join(AYNITE_DIR, AYNITE_SUBDIRS.LOGS)
}

export function getLogPath(filename: string = 'ai-chat.log') {
  return path.join(getAyniteLogsDir(), filename)
}

export function getAyniteSessionsDir() {
  return path.join(AYNITE_DIR, AYNITE_SUBDIRS.SESSIONS)
}

// ─── Legacy date-based session paths (deprecated, kept for migration) ─────

export function getSessionPath(
  sessionId: string,
  date?: string,
  workspace?: string,
) {
  const dateStr = date || new Date().toISOString().split('T')[0]
  const base = workspace
    ? getWorkspaceSessionsDir(workspace)
    : getAyniteSessionsDir()
  return path.join(base, dateStr, `${sessionId}.json`)
}

export function getSessionMetadataPath(
  sessionId: string,
  date?: string,
  workspace?: string,
) {
  const dateStr = date || new Date().toISOString().split('T')[0]
  const base = workspace
    ? getWorkspaceSessionsDir(workspace)
    : getAyniteSessionsDir()
  return path.join(base, dateStr, `${sessionId}-metadata.json`)
}

export function getSessionsDateDir(date: string, workspace?: string) {
  const base = workspace
    ? getWorkspaceSessionsDir(workspace)
    : getAyniteSessionsDir()
  return path.join(base, date)
}

// ─── New flat session paths (each session has its own folder) ──────────────

/**
 * Get the directory for a session: workspaces/<name>/sessions/<session-id>/
 */
export function getSessionDir(sessionId: string, workspace: string): string {
  return path.join(getWorkspaceSessionsDir(workspace), sessionId)
}

/**
 * Get the messages file path for a session:
 * workspaces/<name>/sessions/<session-id>/messages.json
 */
export function getSessionMessagesPath(
  sessionId: string,
  workspace: string,
): string {
  return path.join(getSessionDir(sessionId, workspace), 'messages.json')
}

/**
 * Get the metadata file path for a session:
 * workspaces/<name>/sessions/<session-id>/metadata.json
 */
export function getSessionMetadataFilePath(
  sessionId: string,
  workspace: string,
): string {
  return path.join(getSessionDir(sessionId, workspace), 'metadata.json')
}

/**
 * Get the path for a compaction backup:
 * workspaces/<name>/sessions/<session-id>/compacted-<timestamp>.json
 */
export function getSessionCompactPath(
  sessionId: string,
  timestamp: number,
  workspace: string,
): string {
  return path.join(
    getSessionDir(sessionId, workspace),
    `compacted-${timestamp}.json`,
  )
}

export function getAynitePromptsDir() {
  return path.join(AYNITE_DIR, AYNITE_SUBDIRS.PROMPTS)
}

export function getAynitePromptPath(filename: string) {
  return path.join(AYNITE_DIR, AYNITE_SUBDIRS.PROMPTS, filename)
}

export function getWorkspacesConfigPath() {
  return path.join(getAyniteConfigDir(), 'workspaces.json')
}

export function getWorkspacesDir() {
  return getAynitePath('workspaces')
}

export function getWorkspaceDataPath(name: string) {
  return path.join(getWorkspacesDir(), name, 'config.json')
}

export function getWorkspaceDir(name: string) {
  return path.join(getWorkspacesDir(), name)
}

export function getWorkspaceSessionsDir(name: string) {
  return path.join(getWorkspacesDir(), name, 'sessions')
}

export function getWorkspaceArtifactsDir(name: string) {
  return path.join(getWorkspacesDir(), name, 'artifacts')
}

export function getWorkspaceTaskPath(name: string, filename = 'task.md') {
  return path.join(getWorkspaceArtifactsDir(name), filename)
}

export function getWorkspaceMemoryPath(name: string) {
  return path.join(getWorkspaceArtifactsDir(name), 'memory.md')
}

export function getWorkspacePlanPath(name: string) {
  return path.join(getWorkspaceArtifactsDir(name), 'implementation_plan.md')
}

export function getAIConfigPath() {
  return path.join(getAyniteConfigDir(), 'ai.json')
}

export function getMessengersConfigPath() {
  return path.join(getAyniteConfigDir(), 'messengers.json')
}

export function getKeybindingsConfigPath() {
  return path.join(getAyniteConfigDir(), 'keybindings.json')
}

export function getIgnoreConfigPath() {
  return path.join(getAyniteConfigDir(), 'ignore')
}

export function getMainConfigPath() {
  return path.join(getAyniteConfigDir(), 'config.json')
}

export function getAppearanceConfigPath() {
  return path.join(getAyniteConfigDir(), 'appearance.json')
}

export function getThemesDir() {
  return getAynitePath('themes')
}

export function getThemePath(name: string) {
  return getAynitePath('themes', `${name}.json`)
}

export function getRssDir() {
  return getAynitePath('rss')
}

export function getRssConfigPath() {
  return getAynitePath('rss', 'config.json')
}

export function getRssContentsDir() {
  return getAynitePath('rss', 'contents')
}

export function getRssContentPath(date: string, sourceId: string) {
  return getAynitePath('rss', 'contents', date, `${sourceId}.json`)
}

export function getRssBookmarksPath() {
  return getAynitePath('rss', 'bookmarks.json')
}

export function getRssSummariesDir() {
  return getAynitePath('rss', 'summaries')
}

export function getRssSummaryPath(itemId: string) {
  return getAynitePath('rss', 'summaries', `${itemId}.json`)
}

export function getSpotifyDir() {
  return getAynitePath('spotify')
}

export function getSpotifyConfigPath() {
  return getAynitePath('spotify', 'config.json')
}

export function getSpotifyProfilePath() {
  return getAynitePath('spotify', 'profile.json')
}

export function getSpotifyRecentlyPlayedPath() {
  return getAynitePath('spotify', 'recently-played.json')
}

export function getSpotifySavedTracksPath() {
  return getAynitePath('spotify', 'saved-tracks.json')
}

export function getSpotifyTopArtistsPath() {
  return getAynitePath('spotify', 'top-artists.json')
}

export function getSpotifyTopTracksPath() {
  return getAynitePath('spotify', 'top-tracks.json')
}

export function getSpotifyPlaylistsPath() {
  return getAynitePath('spotify', 'playlists.json')
}

export function getSpotifyPlaylistTracksPath(id: string) {
  return getAynitePath('spotify', 'playlist-tracks', `${id}.json`)
}

export function getSpotifyMetadataPath() {
  return getAynitePath('spotify', 'metadata.json')
}

export function getPlaybookPath() {
  return getAynitePath('aynite-playbook')
}

export function getWelcomeMdPath() {
  return path.join(getPlaybookPath(), 'Welcome.md')
}

export function getViewConfigDir(viewName: string) {
  return getAynitePath(AYNITE_SUBDIRS.VIEWS, viewName)
}

export function getViewConfigPath(viewName: string) {
  return path.join(getViewConfigDir(viewName), 'config.json')
}

export function getPreloadPath(baseDir: string) {
  return path.resolve(baseDir, '../preload/index.js')
}

export function getRendererHtmlPath(baseDir: string) {
  return path.resolve(baseDir, '../renderer/index.html')
}

export function getIconPath(baseDir: string) {
  return path.resolve(baseDir, '../../build/icon.png')
}

export function getAgentsDir() {
  return getAynitePath(AYNITE_SUBDIRS.AGENTS)
}

export function getAgentPath(agentId: string) {
  return getAynitePath(AYNITE_SUBDIRS.AGENTS, `${agentId}.json`)
}

// ─── Bot / Messenger Paths ──────────────────────────────────────────────

/** Root bots directory: ~/.aynite/bots/ */
export function getBotsDir(): string {
  return getAynitePath(AYNITE_SUBDIRS.BOTS)
}

/** Per-messenger directory: ~/.aynite/bots/<messengerId>/ */
export function getBotDir(messengerId: string): string {
  return path.join(getBotsDir(), messengerId)
}

/** Per-chat directory: ~/.aynite/bots/<messengerId>/<chatName>/ */
export function getBotChatDir(messengerId: string, chatName: string): string {
  return path.join(getBotDir(messengerId), chatName)
}

/** Per-chat date-based message log:
 *  ~/.aynite/bots/<messengerId>/<chatName>/<date>.json */
export function getBotChatDatePath(
  messengerId: string,
  chatName: string,
  date: string,
): string {
  return path.join(getBotChatDir(messengerId, chatName), `${date}.json`)
}

/** Per-chat session directory:
 *  ~/.aynite/bots/<messengerId>/<chatName>/session/ */
export function getBotSessionDir(
  messengerId: string,
  chatName: string,
): string {
  return path.join(getBotChatDir(messengerId, chatName), 'session')
}

/** Session messages file:
 *  ~/.aynite/bots/<messengerId>/<chatName>/session/messages.json */
export function getBotSessionMessagesPath(
  messengerId: string,
  chatName: string,
): string {
  return path.join(getBotSessionDir(messengerId, chatName), 'messages.json')
}

/** Session metadata file:
 *  ~/.aynite/bots/<messengerId>/<chatName>/session/metadata.json */
export function getBotSessionMetadataPath(
  messengerId: string,
  chatName: string,
): string {
  return path.join(getBotSessionDir(messengerId, chatName), 'metadata.json')
}

/** Session compaction backup:
 *  ~/.aynite/bots/<messengerId>/<chatName>/session/compacted-<timestamp>.json */
export function getBotSessionCompactPath(
  messengerId: string,
  chatName: string,
  timestamp: number,
): string {
  return path.join(
    getBotSessionDir(messengerId, chatName),
    `compacted-${timestamp}.json`,
  )
}

export function getSkillsDir() {
  return getAynitePath('skills')
}

export function getCommandsDir() {
  return getAynitePath('commands')
}

export function getSkillPath(skillName: string) {
  return path.join(getSkillsDir(), skillName)
}

export function getCommandPath(commandName: string) {
  return path.join(getCommandsDir(), commandName)
}

// --- Path Utilities (Wrapped to avoid direct path module usage) ---

export function getBasename(p: string, ext?: string) {
  return path.basename(p, ext)
}

export function getDirname(p: string) {
  return path.dirname(p)
}

export function getExtname(p: string) {
  return path.extname(p)
}

export function getRelativePath(from: string, to: string) {
  return path.relative(from, to)
}

export function getAbsolutePath(p: string, base?: string) {
  if (base) return path.resolve(base, p)
  return path.resolve(p)
}

export function getPathSep() {
  return path.sep
}

export function joinPaths(...parts: string[]) {
  return path.join(...parts)
}

/**
 * Checks if a target path is within a set of allowed domain folders.
 */
export function isPathWithinDomain(
  targetPath: string,
  domainFolders: string[],
): boolean {
  if (!targetPath) return false
  const resolvedTarget = path.resolve(expandHome(targetPath))
  const result = domainFolders.some((folder) => {
    const resolvedFolder = path.resolve(expandHome(folder))
    return (
      resolvedTarget === resolvedFolder ||
      resolvedTarget.startsWith(resolvedFolder + path.sep)
    )
  })
  if (!result) {
    console.warn(
      `[isPathWithinDomain] Access denied: "${resolvedTarget}" is not within any of [${domainFolders.join(', ')}]`,
    )
  }
  return result
}

export function expandHome(filePath: string): string {
  if (filePath.startsWith('~')) {
    return path.join(homedir(), filePath.slice(1))
  }
  return filePath
}
