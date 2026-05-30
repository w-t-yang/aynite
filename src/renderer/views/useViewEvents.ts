/**
 * useViewEvents — Hooks for listening to relayed app events from iframe views.
 *
 * Views (micro-frontends running in iframes) receive events from the main
 * renderer via postMessage. These hooks provide a clean way to subscribe to
 * those events without directly using window.message listeners.
 *
 * Architecture note:
 * - AppContext sends events to all iframes via postMessage
 * - Each view in an iframe receives these events here
 * - Views manage their own local state in response to events — this is
 *   correct for micro-frontend architecture where each view is independent
 *
 * @see ViewContext.tsx — deprecated useAppEvent/useAppEventSubscriber aliases
 */

import { useCallback, useEffect } from 'react'

/**
 * Subscribe to a single relayed app event type by name.
 *
 * @param type - Event type string (without the 'aynite:' prefix)
 * @param callback - Called with event data when a matching event arrives
 * @param deps - Additional dependency array items (the type and callback are stable)
 */
export function useViewEvent(
  type: string,
  callback: (data: any) => void,
  deps: any[] = [],
) {
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data
      if (message?.type === `aynite:${type}`) {
        callback(message.data)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, ...deps, callback])
}

/**
 * Subscribe to ALL relayed app events from a single callback.
 *
 * Returns an unsubscribe function for cleanup.
 * The returned function can be stored and called later, or used in a useEffect
 * cleanup. It uses a stable ref internally so it never causes re-registration.
 */
export function useViewEventSubscriber() {
  return useCallback((callback: (event: any) => void) => {
    const handler = (e: MessageEvent) => {
      const msg = e.data
      if (msg?.type?.startsWith('aynite:')) {
        callback({ type: msg.type.replace('aynite:', ''), data: msg.data })
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])
}
