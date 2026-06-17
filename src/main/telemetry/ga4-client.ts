/**
 * ga4-client — GA4 Measurement Protocol client.
 *
 * Handles GA4 URL configuration, event serialization, fetch calls,
 * and user_properties. No session or timer logic — purely the
 * protocol layer.
 */

import { app } from 'electron'
import type { TelemetryEvent } from '../../lib/types/telemetry'

export type { TelemetryEvent }

// ─── GA4 Configuration ─────────────────────────────────────────────────────
const GA_MEASUREMENT_ID = 'G-P0QDN2TKZX'
const GA_API_SECRET = '92hqMyEjT2athgO24zHPzQ'
const GA_URL = `https://www.google-analytics.com/mp/collect?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${GA_API_SECRET}`

// ─── Public API ────────────────────────────────────────────────────────────

export async function flushEvents(
  clientId: string,
  events: TelemetryEvent[],
): Promise<void> {
  if (events.length === 0) return

  try {
    await fetch(GA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        events,
        user_properties: {
          app_version: { value: app.getVersion() },
          platform: { value: process.platform },
          is_packaged: { value: app.isPackaged ? 'true' : 'false' },
        },
      }),
    })
  } catch (err) {
    console.debug('[Telemetry] Flush failed:', err)
  }
}
