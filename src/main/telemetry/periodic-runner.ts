/**
 * PeriodicRunner — Shared utility wrapping setInterval with start/stop/cleanup.
 *
 * Eliminates duplicated interval management across flush timer and
 * engagement heartbeat in the telemetry module.
 */

export class PeriodicRunner {
  private timer: ReturnType<typeof setInterval> | null = null
  private readonly intervalMs: number
  private readonly callback: () => void

  constructor(intervalMs: number, callback: () => void) {
    this.intervalMs = intervalMs
    this.callback = callback
  }

  /** Start the periodic timer. No-op if already running. */
  start(): void {
    if (this.timer !== null) return
    this.timer = setInterval(() => {
      this.callback()
    }, this.intervalMs)
  }

  /** Stop the periodic timer. No-op if not running. */
  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  /** Check if the timer is currently running. */
  get isRunning(): boolean {
    return this.timer !== null
  }
}
