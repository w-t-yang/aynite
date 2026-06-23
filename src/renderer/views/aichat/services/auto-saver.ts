/**
 * AutoSaver — Debounced session save with 1s timer.
 *
 * Watches session state changes, debounces saves, builds metadata
 * from AI/agent config, and persists via aiMutations.saveSession.
 * Guards against empty-save races with clearChat().
 */

import type { UIMessage } from 'ai'
import type { InternalSession } from '../../../../lib/types/chat'
import { ai, aiMutations } from '../../../bridge/ai'
import { config } from '../../../bridge/config'

/**
 * Extract the text of the first user message to use as a session summary.
 */
function getFirstUserSummary(messages: UIMessage[]): string | undefined {
  const firstUser = messages.find((m) => m.role === 'user')
  if (!firstUser) return undefined
  const text =
    firstUser.parts
      ?.filter((p) => p.type === 'text')
      .map((p: any) => p.text)
      .join('')
      ?.trim() || undefined
  return text
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Schedule a debounced save for a session.
 * Waits 1 second after the last state change before persisting.
 * Skips save if messages haven't changed (snapshot comparison).
 * Guards against overwriting disk data with an empty array after clearChat().
 */
export function scheduleSave(session: InternalSession): void {
  const sid = session.state.sessionId
  if (!sid || session.state.messages.length === 0) return

  // Skip save if messages haven't changed since last save
  const snapshot = JSON.stringify(session.state.messages)
  if (snapshot === session.lastSavedSnapshot) return

  if (session.saveTimer) clearTimeout(session.saveTimer)
  session.saveTimer = setTimeout(async () => {
    try {
      // Guard: messages may have been cleared by clearChat() while the timer
      // callback was queued or during an await below. Don't overwrite disk
      // data with an empty array.
      if (session.state.messages.length === 0) return

      const [aiConfig, agentsConfig, currentMetadata] = await Promise.all([
        config.get('ai'),
        config.get('agents'),
        ai.getSessionMetadata(sid),
      ])

      // Guard again after async IPC — clearChat() may have run during the await
      if (session.state.messages.length === 0) return

      const activeProvider =
        aiConfig?.providers?.find((p: any) => p.id === aiConfig.activeId) ||
        aiConfig?.providers?.[0]
      const activeAgent = agentsConfig?.list?.find(
        (a: any) => a.id === agentsConfig?.activeId,
      )

      // If there's no summary yet, compute it from the first user message.
      // The summary is set once up front (first user message) and later
      // updated only by the compact service (AI-generated one-sentence summary).
      const summary =
        currentMetadata?.summary || getFirstUserSummary(session.state.messages)

      const metadata: Record<string, unknown> = {
        agentName: activeAgent?.name || 'Chat',
        modelName: activeProvider?.name || activeProvider?.model || 'AI',
        type: 'general',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      if (summary) {
        metadata.summary = summary
      }
      await aiMutations.saveSession(sid, session.state.messages, metadata)
      session.lastSavedSnapshot = snapshot
    } catch {
      // silent
    }
  }, 1000)
}
