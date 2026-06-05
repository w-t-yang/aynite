/**
 * Telemetry module — Google Analytics 4 Measurement Protocol integration
 *
 * Tracks anonymous app usage events (opt-in only). No PII is sent.
 * Events are batched in memory and flushed to GA4 every 60 seconds and on app quit.
 *
 * GA4 Measurement Protocol: https://developers.google.com/analytics/devguides/collection/protocol/ga4
 */

import { randomUUID } from 'node:crypto'
import { app } from 'electron'
import { getMainConfigPath, readJson } from '../../lib/path'

// ─── GA4 Configuration ─────────────────────────────────────────────────────
// These are GA4 Measurement Protocol credentials — they are public-facing
// identifiers, not secrets. The API secret restricts data to your GA4 property.
// In a production build, these could be injected at build time via env vars.
const GA_MEASUREMENT_ID = 'G-P0QDN2TKZX'
const GA_API_SECRET = '92hqMyEjT2athgO24zHPzQ'
const GA_URL = `https://www.google-analytics.com/mp/collect?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${GA_API_SECRET}`

// ─── Types ─────────────────────────────────────────────────────────────────

interface TelemetryEvent {
  name: string
  params: Record<string, string | number | boolean>
  timestamp_micros: string
}

interface TelemetryState {
  clientId: string
  sessionId: string
  sessionStart: number
  enabled: boolean
  buffer: TelemetryEvent[]
  flushTimer: ReturnType<typeof setInterval> | null
}

// ─── State ─────────────────────────────────────────────────────────────────

const state: TelemetryState = {
  clientId: '',
  sessionId: '',
  sessionStart: 0,
  enabled: false,
  buffer: [],
  flushTimer: null,
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Load telemetry config from ~/.aynite/config.json.
 * Creates default: { enabled: false, clientId: <uuid> } if missing.
 */
async function loadTelemetryConfig(): Promise<{
  enabled: boolean
  clientId: string
}> {
  try {
    const config = await readJson<Record<string, any>>(getMainConfigPath(), {})
    const telemetry = config.telemetry as
      | { enabled?: boolean; clientId?: string }
      | undefined
    return {
      enabled: telemetry?.enabled === true,
      clientId:
        telemetry?.clientId || config._telemetryClientId || randomUUID(),
    }
  } catch {
    return { enabled: false, clientId: randomUUID() }
  }
}

/**
 * Flush buffered events to GA4.
 */
async function flush(): Promise<void> {
  if (!state.enabled || state.buffer.length === 0) return

  const events = state.buffer.splice(0)
  state.buffer = []

  try {
    await fetch(GA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: state.clientId,
        events,
      }),
    })
  } catch (err) {
    // Silently fail — telemetry should never interrupt the app
    console.debug('[Telemetry] Flush failed:', err)
  }
}

/**
 * Start periodic flush timer (every 60 seconds).
 */
function startFlushTimer(): void {
  if (state.flushTimer) return
  state.flushTimer = setInterval(() => {
    flush()
  }, 60_000)
}

/**
 * Stop the periodic flush timer.
 */
function stopFlushTimer(): void {
  if (state.flushTimer) {
    clearInterval(state.flushTimer)
    state.flushTimer = null
  }
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Track an app usage event.
 * Safe to call from anywhere in the main process — does not throw.
 *
 * @param name - Event name (snake_case, e.g. 'file_opened', 'ai_chat_started')
 * @param params - Optional event parameters (primitives only, no PII)
 */
export function trackEvent(
  name: string,
  params: Record<string, string | number | boolean> = {},
): void {
  if (!state.enabled) return

  state.buffer.push({
    name,
    params: {
      ...params,
      platform: process.platform,
      app_version: app.getVersion(),
      session_id: state.sessionId,
    },
    timestamp_micros: String(Date.now() * 1000),
  })

  // Flush immediately if buffer is getting large (>25 events)
  if (state.buffer.length >= 25) {
    flush()
  }
}

/**
 * Start a telemetry session.
 * Called on app ready. Loads config and sets up the session.
 */
export async function startSession(): Promise<void> {
  const config = await loadTelemetryConfig()
  state.clientId = config.clientId
  state.enabled = config.enabled

  if (!state.enabled) return

  state.sessionId = randomUUID()
  state.sessionStart = Date.now()

  trackEvent('app_start', {
    is_packaged: app.isPackaged,
  })

  startFlushTimer()
}

/**
 * End the telemetry session.
 * Called on app quit. Flushes remaining events immediately.
 */
export async function endSession(): Promise<void> {
  if (!state.enabled) return

  const durationSec = Math.round((Date.now() - state.sessionStart) / 1000)

  trackEvent('app_end', {
    session_duration_sec: durationSec,
  })

  stopFlushTimer()
  await flush()
}

/**
 * Enable or disable telemetry at runtime.
 * Called when the user toggles the setting.
 */
export function setTelemetryEnabled(enabled: boolean): void {
  state.enabled = enabled

  if (enabled && !state.sessionId) {
    state.sessionId = randomUUID()
    state.sessionStart = Date.now()
    trackEvent('app_start', { is_packaged: app.isPackaged })
    startFlushTimer()
  } else if (enabled && state.sessionId) {
    // Was already enabled, just restart flush timer
    startFlushTimer()
  } else {
    stopFlushTimer()
    state.buffer = []
  }
}

/**
 * Check if telemetry is currently enabled.
 */
export function isTelemetryEnabled(): boolean {
  return state.enabled
}
