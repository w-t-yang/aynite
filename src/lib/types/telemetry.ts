/**
 * Telemetry types — shared between ga4-client and index.
 */

export interface TelemetryEvent {
  name: string
  params: Record<string, string | number | boolean>
  timestamp_micros: string
}
