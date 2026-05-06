import { useEffect, useRef } from 'react'

type AppEventHandler = (data: unknown) => void

/**
 * Mounted once in the main app shell (e.g. in ThemeContext or App.tsx).
 * Listens for broadcast app events via IPC and relays them to iframe views
 * via postMessage (since webContents.send doesn't reach subframe preloads).
 */
export function AppEventRelay() {
  useEffect(() => {
    const w = window as any
    if (!w.aynite?.onAppEvent) return
    const unsub = w.aynite.onAppEvent(
      (event: { type: string; data: unknown }) => {
        for (const iframe of document.querySelectorAll<HTMLIFrameElement>(
          'iframe',
        )) {
          iframe.contentWindow?.postMessage(
            { type: `aynite:${event.type}`, data: event.data },
            '*',
          )
        }
      },
    )
    return () => unsub()
  }, [])
  return null
}

/**
 * Subscribe to a typed app event broadcast from the main process.
 * Works in both the main renderer and iframe views — events reach views
 * via postMessage relayed through AppEventRelay.
 *
 * @example
 * useAppEvent('theme-changed', (data) => {
 *   loadTheme(data as string)
 * })
 */
export function useAppEvent(type: string, handler: AppEventHandler) {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === `aynite:${type}`) {
        handlerRef.current(event.data.data)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [type])
}
