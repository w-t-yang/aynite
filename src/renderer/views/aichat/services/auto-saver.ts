/**
 * AutoSaver — Debounced session save with 1s timer.
 *
 * Watches session state changes, debounces saves, builds metadata
 * from AI/agent config, and persists via aiMutations.saveSession.
 * Guards against empty-save races with clearChat().
 */

import type { InternalSession } from '../../../../lib/types/chat'
import { aiMutations } from '../../../bridge/ai'
import { config } from '../../../bridge/config'

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

      const aiConfig = await config.get('ai')
      const agentsConfig = await config.get('agents')

      // Guard again after async IPC — clearChat() may have run during the await
      if (session.state.messages.length === 0) return

      const activeProvider =
        aiConfig?.providers?.find((p: any) => p.id === aiConfig.activeId) ||
        aiConfig?.providers?.[0]
      const activeAgent = agentsConfig?.list?.find(
        (a: any) => a.id === agentsConfig?.activeId,
      )
      const metadata = {
        agentName: activeAgent?.name || 'Chat',
        modelName: activeProvider?.name || activeProvider?.model || 'AI',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      await aiMutations.saveSession(sid, session.state.messages, metadata)
      session.lastSavedSnapshot = snapshot
    } catch {
      // silent
    }
  }, 1000)
}
