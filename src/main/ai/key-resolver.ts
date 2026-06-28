/**
 * Dynamic API key resolver.
 *
 * For static keys: returns the key as-is.
 * For dynamic keys: executes a one-liner script, caches the result with TTL,
 * and refreshes when >80% of TTL has elapsed.
 *
 * If the script fails, throws an error with a clear message so the user
 * knows to investigate their dynamic key configuration.
 */

import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import type { DynamicApiKeyConfig } from '../../lib/types/ai'

const execAsync = promisify(exec)

// ─── Cache ──────────────────────────────────────────────────────────────

interface CacheEntry {
  value: string
  expiresAt: number
  /** The TTL threshold (80%) — refresh if we're past this point */
  refreshThreshold: number
}

const cache = new Map<string, CacheEntry>()

const DEFAULT_TTL_SECONDS = 60

/**
 * Resolve an API key to a string.
 *
 * - If `key` is a string (static), returns it directly.
 * - If `key` is a DynamicApiKeyConfig, executes the script, caches with TTL.
 * - If the cached value is within 80% of TTL, returns cached.
 * - If >80% consumed, refreshes proactively.
 * - If expired, refreshes.
 */
export async function resolveApiKey(
  key: string | DynamicApiKeyConfig | undefined,
): Promise<string> {
  // Static key
  if (!key || typeof key === 'string') {
    return key || ''
  }

  // Dynamic key
  const config = key as DynamicApiKeyConfig
  if (!config.script?.trim()) {
    throw new Error(
      `Dynamic API key has no script configured. Please set a script in the AI provider settings.`,
    )
  }

  const now = Date.now()
  const cached = cache.get(config.script)

  if (cached && now < cached.refreshThreshold) {
    // Within 80% of TTL — use cached value
    return cached.value
  }

  if (cached && now < cached.expiresAt) {
    // Between 80% and 100% of TTL — refresh proactively
    try {
      const fresh = await executeScript(config.script)
      setCache(config.script, fresh, config.ttl)
      return fresh
    } catch {
      // Script failed, but cached value is still valid — return it
      return cached.value
    }
  }

  // Expired or no cache — fetch fresh
  const fresh = await executeScript(config.script)
  setCache(config.script, fresh, config.ttl)
  return fresh
}

/**
 * Execute a shell one-liner and return the trimmed stdout.
 * Throws an error with a user-friendly message if execution fails.
 */
async function executeScript(script: string): Promise<string> {
  try {
    const { stdout } = await execAsync(script, { timeout: 10000 })
    const key = stdout.trim()
    if (!key) {
      throw new Error(
        `The dynamic key script "${script.slice(0, 60)}" returned an empty result. ` +
          `Please verify the script outputs your API key to stdout and try again.`,
      )
    }
    return key
  } catch (err) {
    if (err instanceof Error && err.message) {
      throw new Error(
        `Failed to resolve dynamic API key. Script: "${script.slice(0, 60)}"\n` +
          `Error: ${err.message}\n\n` +
          `Please check your script configuration in AI provider settings.`,
      )
    }
    throw new Error(
      `Failed to resolve dynamic API key. Please check your script configuration in AI provider settings.`,
    )
  }
}

/**
 * Store a resolved key in the cache with TTL tracking.
 */
function setCache(
  script: string,
  value: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
) {
  const ttl = Math.max(ttlSeconds, 1) * 1000 // Minimum 1 second
  const now = Date.now()
  cache.set(script, {
    value,
    expiresAt: now + ttl,
    refreshThreshold: now + ttl * 0.8,
  })
}

/**
 * Clear the entire key cache (useful for testing or config changes).
 */
export function clearKeyCache() {
  cache.clear()
}
