/**
 * Telemetry module — Google Analytics 4 Measurement Protocol integration
 *
 * Tracks anonymous app usage events (opt-in only). No PII is sent.
 * Events are batched in memory and flushed to GA4 every 60 seconds and on app quit.
 *
 * GA4 Measurement Protocol: https://developers.google.com/analytics/devguides/collection/protocol/ga4
 *
 * Composes:
 *   - ga4-client.ts: Protocol layer (URL, fetch, event serialization)
 *   - periodic-runner.ts: Shared setInterval wrapper
 *
 * Owns:
 *   - Session lifecycle (start/end)
 *   - Config persistence (load/save telemetry settings)
 *   - Buffer management (in-memory event queue)
 *   - Public event tracking API
 */

import { randomUUID } from 'node:crypto'
import { app } from 'electron'
import { ENGAGEMENT_TIME_MS } from '../../lib/constants/telemetry'
import { getMainConfigPath, readJson, writeJson } from '../../lib/path'
import type { TelemetryEvent } from '../../lib/types/telemetry'
import { flushEvents } from './ga4-client'
import { PeriodicRunner } from './periodic-runner'

// ─── Constants ─────────────────────────────────────────────────────────────

const FLUSH_INTERVAL_MS = 60_000
const ENGAGEMENT_HEARTBEAT_MS = 30_000
const AUTO_FLUSH_THRESHOLD = 25

// ─── Types ─────────────────────────────────────────────────────────────────

interface TelemetryState {
  clientId: string
  sessionId: string
  sessionStart: number
  enabled: boolean
  buffer: TelemetryEvent[]
  flushRunner: PeriodicRunner | null
  heartbeatRunner: PeriodicRunner | null
  hasSentFirstOpen: boolean
  lastTrackedVersion: string
}

// ─── State ─────────────────────────────────────────────────────────────────

const state: TelemetryState = {
  clientId: '',
  sessionId: '',
  sessionStart: 0,
  enabled: false,
  buffer: [],
  flushRunner: null,
  heartbeatRunner: null,
  hasSentFirstOpen: false,
  lastTrackedVersion: '',
}

// ─── Config Persistence ────────────────────────────────────────────────────

async function loadTelemetryConfig(): Promise<{
  enabled: boolean
  clientId: string
  hasSentFirstOpen: boolean
  lastTrackedVersion: string
}> {
  try {
    const config = await readJson<Record<string, any>>(getMainConfigPath(), {})
    const telemetry = config.telemetry as
      | {
          enabled?: boolean
          clientId?: string
          hasSentFirstOpen?: boolean
          lastVersion?: string
        }
      | undefined
    return {
      enabled: telemetry?.enabled === true,
      clientId:
        telemetry?.clientId || config._telemetryClientId || randomUUID(),
      hasSentFirstOpen: telemetry?.hasSentFirstOpen === true,
      lastTrackedVersion: telemetry?.lastVersion || '',
    }
  } catch {
    return {
      enabled: false,
      clientId: randomUUID(),
      hasSentFirstOpen: false,
      lastTrackedVersion: '',
    }
  }
}

async function saveTelemetryValue(
  key: string,
  value: boolean | string,
): Promise<void> {
  try {
    const config = await readJson<Record<string, any>>(getMainConfigPath(), {})
    if (!config.telemetry) config.telemetry = {}
    config.telemetry[key] = value
    await writeJson(getMainConfigPath(), config)
  } catch {
    // Silently fail
  }
}

// ─── Buffer Management ─────────────────────────────────────────────────────

function pushEvent(
  name: string,
  params: Record<string, string | number | boolean> = {},
): void {
  if (!state.enabled) return

  state.buffer.push({
    name,
    params: {
      ...params,
      engagement_time_msec: ENGAGEMENT_TIME_MS,
      platform: process.platform,
      app_version: app.getVersion(),
      session_id: state.sessionId,
    },
    timestamp_micros: String(Date.now() * 1000),
  })

  if (state.buffer.length >= AUTO_FLUSH_THRESHOLD) {
    performFlush()
  }
}

function performFlush(): void {
  if (state.buffer.length === 0) return
  const events = state.buffer.splice(0)
  state.buffer = []
  flushEvents(state.clientId, events)
}

// ─── Timer Lifecycle (via PeriodicRunner) ──────────────────────────────────

function startTimers(): void {
  if (!state.flushRunner) {
    state.flushRunner = new PeriodicRunner(FLUSH_INTERVAL_MS, () =>
      performFlush(),
    )
  }
  if (!state.heartbeatRunner) {
    state.heartbeatRunner = new PeriodicRunner(ENGAGEMENT_HEARTBEAT_MS, () => {
      if (!state.enabled) return
      const elapsedMs = Date.now() - state.sessionStart
      pushEvent('user_engagement', {
        engagement_time_msec: elapsedMs,
        session_id: state.sessionId,
      })
    })
  }
  state.flushRunner.start()
  state.heartbeatRunner.start()
}

function stopTimers(): void {
  state.flushRunner?.stop()
  state.heartbeatRunner?.stop()
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Track an app usage event.
 * Safe to call from anywhere in the main process — does not throw.
 */
export function trackEvent(
  name: string,
  params: Record<string, string | number | boolean> = {},
): void {
  pushEvent(name, params)
}

/**
 * Track a page/view being opened.
 */
export function trackPageView(viewName: string): void {
  pushEvent('screen_view', {
    screen_name: viewName,
    engagement_time_msec: ENGAGEMENT_TIME_MS,
  })
}

/**
 * Track when a notification is shown to the user.
 */
export function trackNotification(type: string, title: string): void {
  pushEvent('notification', {
    notification_type: type,
    notification_title: title.slice(0, 60),
  })
}

/**
 * Start a telemetry session.
 * Called on app ready. Loads config and sets up the session.
 */
export async function startSession(): Promise<void> {
  const config = await loadTelemetryConfig()
  state.clientId = config.clientId
  state.enabled = config.enabled
  state.hasSentFirstOpen = config.hasSentFirstOpen
  state.lastTrackedVersion = config.lastTrackedVersion

  if (!state.enabled) return

  state.sessionId = randomUUID()
  state.sessionStart = Date.now()
  const currentVersion = app.getVersion()

  if (!state.hasSentFirstOpen) {
    pushEvent('first_open', {
      engagement_time_msec: ENGAGEMENT_TIME_MS,
      app_version: currentVersion,
    })
    state.hasSentFirstOpen = true
    saveTelemetryValue('hasSentFirstOpen', true)
  }

  if (state.lastTrackedVersion && state.lastTrackedVersion !== currentVersion) {
    pushEvent('app_version_updated', {
      from_version: state.lastTrackedVersion.slice(0, 20),
      to_version: currentVersion.slice(0, 20),
    })
  }
  state.lastTrackedVersion = currentVersion
  saveTelemetryValue('lastVersion', currentVersion)

  pushEvent('session_start', { engagement_time_msec: ENGAGEMENT_TIME_MS })
  pushEvent('app_start', {
    is_packaged: app.isPackaged,
    app_version: currentVersion,
  })

  startTimers()
}

/**
 * End the telemetry session.
 * Called on app quit. Flushes remaining events immediately.
 */
export async function endSession(): Promise<void> {
  if (!state.enabled) return

  const durationSec = Math.round((Date.now() - state.sessionStart) / 1000)
  pushEvent('app_end', {
    session_duration_sec: durationSec,
    engagement_time_msec: ENGAGEMENT_TIME_MS,
  })

  stopTimers()
  await performFlush()
}

/**
 * Enable or disable telemetry at runtime.
 */
export function setTelemetryEnabled(enabled: boolean): void {
  state.enabled = enabled

  if (enabled && !state.sessionId) {
    state.sessionId = randomUUID()
    state.sessionStart = Date.now()

    if (!state.hasSentFirstOpen) {
      pushEvent('first_open', { engagement_time_msec: ENGAGEMENT_TIME_MS })
      state.hasSentFirstOpen = true
      saveTelemetryValue('hasSentFirstOpen', true)
    }

    pushEvent('session_start', { engagement_time_msec: ENGAGEMENT_TIME_MS })
    pushEvent('app_start', { is_packaged: app.isPackaged })
    startTimers()
  } else if (enabled && state.sessionId) {
    startTimers()
  } else {
    stopTimers()
    state.buffer = []
  }
}

/**
 * Check if telemetry is currently enabled.
 */
export function isTelemetryEnabled(): boolean {
  return state.enabled
}
