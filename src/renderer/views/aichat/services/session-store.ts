/**
 * SessionStore — Manages session state containers and subscriptions.
 *
 * Owns the module-level sessions Map, provides getOrCreate/find/check,
 * subscription management, and state update notification.
 * Does NOT handle auto-save (see AutoSaver) or stream dispatch.
 */

import type { InternalSession, SessionState } from '../../../../lib/types/chat'

// ─── Module-level state ───────────────────────────────────────────────────

const sessions = new Map<string, InternalSession>()

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Get or create a session state container.
 */
export function getOrCreateSession(sessionId: string): InternalSession {
  let session = sessions.get(sessionId)
  if (!session) {
    session = {
      state: {
        sessionId,
        messages: [],
        loading: false,
        compacting: false,
        error: null,
        currentStep: null,
        pendingApproval: null,
      },
      abortController: null,
      approvalId: null,
      lastSavedSnapshot: '',
      listeners: new Set(),
      saveTimer: null,
    }
    sessions.set(sessionId, session)
  }
  return session
}

/**
 * Get an existing session, or undefined if it doesn't exist.
 */
export function getSession(sessionId: string): InternalSession | undefined {
  return sessions.get(sessionId)
}

/**
 * Notify all listeners of a session's current state.
 */
export function notify(session: InternalSession): void {
  const state = { ...session.state }
  for (const listener of session.listeners) {
    try {
      listener(state)
    } catch {
      // ignore stale listeners
    }
  }
}

/**
 * Update session state, triggering auto-save and notification.
 * The auto-save callback is injected from ChatService to avoid
 * a circular dependency between SessionStore and AutoSaver.
 *
 * @param onSave - Called when state changes to schedule a save
 */
export function updateState(
  session: InternalSession,
  patch: Partial<SessionState>,
  onSave?: (session: InternalSession) => void,
): void {
  session.state = { ...session.state, ...patch }
  if (onSave) onSave(session)
  notify(session)
}

/**
 * Subscribe to state changes for a given session.
 * Returns an unsubscribe function.
 */
export function subscribe(
  sessionId: string,
  callback: (state: SessionState) => void,
): () => void {
  const session = getOrCreateSession(sessionId)
  session.listeners.add(callback)
  // Immediately call with current state
  callback({ ...session.state })
  return () => {
    session.listeners.delete(callback)
  }
}

/**
 * Get the current state for a session (synchronous).
 */
export function getState(sessionId: string): SessionState | undefined {
  return sessions.get(sessionId)?.state
}

/**
 * Check if a session exists.
 */
export function hasSession(sessionId: string): boolean {
  return sessions.has(sessionId)
}

/**
 * List all active session IDs.
 */
export function listAllSessions(): InternalSession[] {
  return Array.from(sessions.values())
}

/**
 * Remove a session from the store entirely.
 */
export function removeSession(sessionId: string): void {
  const session = sessions.get(sessionId)
  if (session) {
    if (session.saveTimer) clearTimeout(session.saveTimer)
    session.listeners.clear()
    sessions.delete(sessionId)
  }
}
