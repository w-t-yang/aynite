/**
 * Bridge module: AI operations
 *
 * Typed getters and setters for AI chat, sessions, and prompts.
 * Setters return Promise<void> — events (ACTIVE_SESSION_CHANGED, ai-chat-delta) update views.
 */

function getAynite() {
  if (!window.aynite) {
    throw new Error('Aynite bridge not available (not running in Electron?)')
  }
  return window.aynite
}

interface AiChatPayload {
  messages: any[]
  config: any
  workspaceFolders: string[]
  activeFile?: string
  workspaceName?: string
}

interface ChatSessionEntry {
  id: string
  date: string
  lastModified: string
  size?: number
  preview: string
  title: string
  messageCount: number
  messageDateCounts?: Record<string, number>
}

interface DirectCommandPayload {
  commandPath: string
  params: string[]
  currentFile?: string
}

// ── Getters (return data) ────────────────────────────────────────────

export const ai = (() => ({
  listSessions: (): Promise<ChatSessionEntry[]> => getAynite().listSessions(),

  getActivityCounts: (): Promise<Record<string, number>> =>
    getAynite().getActivityCounts(),

  loadSession: (sessionId: string, date?: string): Promise<any> =>
    getAynite().loadSession(sessionId, date),

  getMergedSystemPrompt: (agentId?: string): Promise<string> =>
    getAynite().getMergedSystemPrompt(agentId),

  getArtifactsStatus: (): Promise<any> =>
    (getAynite() as any).getArtifactsStatus(),

  getSessionMetadata: (sessionId: string): Promise<any> =>
    getAynite().getSessionMetadata(sessionId),
}))()

// ── Setters (return void — state changes come through events) ────────

export const aiMutations = (() => ({
  chat: (
    payload: AiChatPayload,
  ): Promise<{ requestId?: string; error?: string }> =>
    getAynite().aiChat(payload),

  saveSession: (
    sessionId: string,
    messages: any[],
    metadata?: any,
  ): Promise<void> => getAynite().saveSession(sessionId, messages, metadata),

  saveCompactBackup: (
    sessionId: string,
    timestamp: number,
    messages: any[],
  ): Promise<void> =>
    getAynite().saveCompactBackup(sessionId, timestamp, messages),

  runDirectCommand: (
    payload: DirectCommandPayload,
  ): Promise<{ stdout: string; stderr: string }> =>
    getAynite().runDirectCommand(payload),

  respondToAiApproval: (id: string, approved: boolean): void =>
    getAynite().respondToAiApproval(id, approved),

  restorePrompts: (): Promise<boolean> => getAynite().restorePrompts(),
}))()

// ── Stream listeners (special — return cleanup functions) ───────────

export const aiStream = (() => ({
  onDelta: (requestId: string, callback: (part: any) => void): (() => void) =>
    getAynite().onAiChatDelta(requestId, callback),

  onApprovalRequest: (
    callback: (data: { id: string; command: string; cwd: string }) => void,
  ): (() => void) => getAynite().onAiApprovalRequest(callback),
}))()
