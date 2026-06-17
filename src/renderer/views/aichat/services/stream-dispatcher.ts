/**
 * StreamDispatcher — Manages AI stream event routing.
 *
 * Maintains a map of requestId → handler so the single permanent event
 * listener in ChatService can dispatch ai-chat-delta events to the
 * correct active stream without creating per-call window.message listeners.
 */

// ─── Module-level state ───────────────────────────────────────────────────

const activeStreams = new Map<string, (part: any) => void>()

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Register a handler for a specific stream requestId.
 */
export function registerStreamHandler(
  requestId: string,
  handler: (part: any) => void,
): void {
  activeStreams.set(requestId, handler)
}

/**
 * Unregister a stream handler when the stream finishes/aborts.
 */
export function unregisterStreamHandler(requestId: string): void {
  activeStreams.delete(requestId)
}

/**
 * Dispatch a stream part to the handler registered for the given requestId.
 * Returns true if a handler was found and called, false otherwise.
 */
export function dispatchStreamEvent(requestId: string, part: any): boolean {
  const handler = activeStreams.get(requestId)
  if (handler) {
    handler(part)
    return true
  }
  return false
}

/**
 * Check if a stream handler is currently registered.
 */
export function hasStreamHandler(requestId: string): boolean {
  return activeStreams.has(requestId)
}
