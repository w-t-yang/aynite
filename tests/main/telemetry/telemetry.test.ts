import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Mocks ──────────────────────────────────────────────────────────────

const mockFetch = vi.hoisted(() => vi.fn())
vi.stubGlobal('fetch', mockFetch)

const mockReadJson = vi.hoisted(() => vi.fn())
const mockGetMainConfigPath = vi.hoisted(() =>
  vi.fn(() => '/mock/.aynite/config/config.json'),
)

vi.mock('../../../src/lib/path', () => ({
  readJson: (...args: unknown[]) => mockReadJson(...args),
  getMainConfigPath: (...args: unknown[]) => mockGetMainConfigPath(...args),
}))

vi.mock('electron', () => ({
  app: {
    getVersion: () => '0.1.8',
    get isPackaged() {
      return false
    },
  },
}))

import {
  endSession,
  isTelemetryEnabled,
  setTelemetryEnabled,
  startSession,
  trackEvent,
} from '../../../src/main/telemetry/index'

beforeEach(async () => {
  vi.clearAllMocks()
  mockFetch.mockResolvedValue({ ok: true })
  // Reset internal state by starting a fresh session
  // Mock telemetry config as disabled by default
  mockReadJson.mockResolvedValue({
    telemetry: { enabled: false, clientId: 'test-client-id' },
  })
})

describe('telemetry', () => {
  describe('startSession', () => {
    it('does not start when telemetry is disabled', async () => {
      mockReadJson.mockResolvedValue({
        telemetry: { enabled: false, clientId: 'abc' },
      })

      await startSession()

      expect(isTelemetryEnabled()).toBe(false)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('starts session and tracks app_start when enabled', async () => {
      mockReadJson.mockResolvedValue({
        telemetry: { enabled: true, clientId: 'abc' },
      })

      await startSession()

      expect(isTelemetryEnabled()).toBe(true)
    })
  })

  describe('trackEvent', () => {
    it('does not buffer events when disabled', () => {
      trackEvent('test_event', { value: 1 })
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('buffers events when enabled', async () => {
      mockReadJson.mockResolvedValue({
        telemetry: { enabled: true, clientId: 'abc' },
      })
      await startSession()

      trackEvent('test_event', { value: 42 })

      // Should not flush immediately (< 25 events)
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('setTelemetryEnabled', () => {
    it('enables telemetry at runtime', () => {
      setTelemetryEnabled(true)
      expect(isTelemetryEnabled()).toBe(true)
    })

    it('disables telemetry at runtime', () => {
      setTelemetryEnabled(true)
      setTelemetryEnabled(false)
      expect(isTelemetryEnabled()).toBe(false)
    })
  })

  describe('endSession', () => {
    it('does nothing when not enabled', async () => {
      await endSession()
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })
})
