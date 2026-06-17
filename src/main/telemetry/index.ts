/**
 * Telemetry module — Google Analytics 4 Measurement Protocol integration
 *
 * Tracks anonymous app usage events (opt-in only). No PII is sent.
 * Events are batched in memory and flushed to GA4 every 60 seconds and on app quit.
 *
 * GA4 Measurement Protocol: https://developers.google.com/analytics/devguides/collection/protocol/ga4
 *
 * GA4 Standard Parameters for user/session tracking:
 * - engagement_time_msec: Marks users as "active" — REQUIRED for Active Users report
 * - session_id + session_start: Enables session counting
 * - first_open: Distinguishes new vs returning users
 * - user_engagement: Periodic heartbeat for engagement tracking
 */

import { randomUUID } from 'node:crypto'
import { app } from 'electron'
import { getMainConfigPath, readJson, writeJson } from '../../lib/path'

// ─── GA4 Configuration ─────────────────────────────────────────────────────
// These are GA4 Measurement Protocol credentials — they are public-facing
// identifiers, not secrets. The API secret restricts data to your GA4 property.
// In a production build, these could be injected at build time via env vars.
const GA_MEASUREMENT_ID = 'G-P0QDN2TKZX'
const GA_API_SECRET = '92hqMyEjT2athgO24zHPzQ'
const GA_URL = `https://www.google-analytics.com/mp/collect?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${GA_API_SECRET}`

// Engagement time sent with every event (in ms). Small non-zero value ensures
// GA4 counts this as an engaged session. Real engagement is tracked via periodic
// user_engagement events with actual elapsed time.
const ENGAGEMENT_TIME_MS = 100

// Heartbeat interval for user_engagement events (30 seconds)
const ENGAGEMENT_HEARTBEAT_MS = 30_000

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
  heartbeatTimer: ReturnType<typeof setInterval> | null
  hasSentFirstOpen: boolean
}

// ─── State ─────────────────────────────────────────────────────────────────

const state: TelemetryState = {
  clientId: '',
  sessionId: '',
  sessionStart: 0,
  enabled: false,
  buffer: [],
  flushTimer: null,
  heartbeatTimer: null,
  hasSentFirstOpen: false,
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Load telemetry config from ~/.aynite/config.json.
 * Creates default: { enabled: false, clientId: <uuid>, hasSentFirstOpen: false } if missing.
 */
async function loadTelemetryConfig(): Promise<{
  enabled: boolean
  clientId: string
  hasSentFirstOpen: boolean
}> {
  try {
    const config = await readJson<Record<string, any>>(getMainConfigPath(), {})
    const telemetry = config.telemetry as
      | { enabled?: boolean; clientId?: string; hasSentFirstOpen?: boolean }
      | undefined
    const hasSentFirstOpen = telemetry?.hasSentFirstOpen === true
    return {
      enabled: telemetry?.enabled === true,
      clientId:
        telemetry?.clientId || config._telemetryClientId || randomUUID(),
      hasSentFirstOpen,
    }
  } catch {
    return { enabled: false, clientId: randomUUID(), hasSentFirstOpen: false }
  }
}

/**
 * Persist telemetry config back to disk (to remember first_open state).
 */
async function saveTelemetryFlag(key: string, value: boolean): Promise<void> {
  try {
    const config = await readJson<Record<string, any>>(getMainConfigPath(), {})
    if (!config.telemetry) config.telemetry = {}
    config.telemetry[key] = value
    await writeJson(getMainConfigPath(), config)
  } catch {
    // Silently fail — telemetry should never interrupt the app
  }
}

/**
 * Flush buffered events to GA4.
 * Includes user_properties for consistent user-level dimensions.
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
        // User properties are sent with every flush for consistent attribution
        user_properties: {
          app_version: { value: app.getVersion() },
          platform: { value: process.platform },
          is_packaged: { value: app.isPackaged ? 'true' : 'false' },
        },
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

/**
 * Start engagement heartbeat — sends user_engagement events periodically
 * so GA4 can track session duration and engagement.
 */
function startHeartbeat(): void {
  if (state.heartbeatTimer) return
  state.heartbeatTimer = setInterval(() => {
    if (!state.enabled) return
    const elapsedMs = Date.now() - state.sessionStart
    state.buffer.push({
      name: 'user_engagement',
      params: {
        engagement_time_msec: elapsedMs,
        session_id: state.sessionId,
      },
      timestamp_micros: String(Date.now() * 1000),
    })
  }, ENGAGEMENT_HEARTBEAT_MS)
}

/**
 * Stop the engagement heartbeat.
 */
function stopHeartbeat(): void {
  if (state.heartbeatTimer) {
    clearInterval(state.heartbeatTimer)
    state.heartbeatTimer = null
  }
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Track an app usage event.
 * Safe to call from anywhere in the main process — does not throw.
 * Every event includes engagement_time_msec to ensure GA4 counts active users.
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
      // engagement_time_msec is REQUIRED by GA4 for Active Users tracking.
      // Without this, GA4 receives events but never counts users as "active".
      engagement_time_msec: ENGAGEMENT_TIME_MS,
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
 * Track a page/view being opened.
 * This enables tracking which views users interact with most.
 * Maps to GA4's recommended page_view/screen_view pattern.
 *
 * @param viewName - The view identifier (e.g. 'aichat', 'file-browser', 'settings')
 */
export function trackPageView(viewName: string): void {
  trackEvent('screen_view', {
    screen_name: viewName,
    engagement_time_msec: ENGAGEMENT_TIME_MS,
  })
}

/**
 * Track when a notification is shown to the user.
 * This helps measure how often users see various notification types.
 */
export function trackNotification(type: string, title: string): void {
  trackEvent('notification', {
    notification_type: type,
    notification_title: title.slice(0, 60), // Truncate to avoid long strings
  })
}

/**
 * Start a telemetry session.
 * Called on app ready. Loads config and sets up the session.
 * Sends first_open (once per client) and session_start events.
 */
export async function startSession(): Promise<void> {
  const config = await loadTelemetryConfig()
  state.clientId = config.clientId
  state.enabled = config.enabled
  state.hasSentFirstOpen = config.hasSentFirstOpen

  if (!state.enabled) return

  state.sessionId = randomUUID()
  state.sessionStart = Date.now()

  // first_open: sent only once per client. GA4 uses this to distinguish
  // new vs returning users for the "New Users" metric.
  if (!state.hasSentFirstOpen) {
    trackEvent('first_open', {
      engagement_time_msec: ENGAGEMENT_TIME_MS,
    })
    state.hasSentFirstOpen = true
    // Persist so we don't send again
    saveTelemetryFlag('hasSentFirstOpen', true)
  }

  // session_start: REQUIRED by GA4 for proper session counting.
  // Without this, all events are collected but GA4 can't group them into sessions.
  trackEvent('session_start', {
    engagement_time_msec: ENGAGEMENT_TIME_MS,
  })

  trackEvent('app_start', {
    is_packaged: app.isPackaged,
  })

  startFlushTimer()
  startHeartbeat()
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
    engagement_time_msec: ENGAGEMENT_TIME_MS,
  })

  stopHeartbeat()
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

    if (!state.hasSentFirstOpen) {
      trackEvent('first_open', {
        engagement_time_msec: ENGAGEMENT_TIME_MS,
      })
      state.hasSentFirstOpen = true
      saveTelemetryFlag('hasSentFirstOpen', true)
    }

    trackEvent('session_start', {
      engagement_time_msec: ENGAGEMENT_TIME_MS,
    })
    trackEvent('app_start', { is_packaged: app.isPackaged })
    startFlushTimer()
    startHeartbeat()
  } else if (enabled && state.sessionId) {
    startFlushTimer()
    startHeartbeat()
  } else {
    stopHeartbeat()
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
