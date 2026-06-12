/**
 * Handlers for the telemetry config key.
 *
 * Telemetry data is stored in ~/.aynite/config.json under the `telemetry` key.
 * On set, it also notifies the telemetry module at runtime so toggling takes
 * effect immediately without restart.
 */
import type { MainConfig } from '../../../lib/constants/types'
import { getMainConfigPath, readJson, writeJson } from '../../../lib/path'
import type { ConfigHandler } from '../handler-registry'

export const telemetryHandlers: ConfigHandler = (() => ({
  get: async () => {
    const config = await readJson<MainConfig>(getMainConfigPath(), {})
    return config.telemetry || { enabled: false }
  },

  set: async (_key: string, payload: any) => {
    const mainConfig = await readJson<MainConfig>(getMainConfigPath(), {})
    mainConfig.telemetry = {
      ...(mainConfig.telemetry || {}),
      ...payload,
    }
    await writeJson(getMainConfigPath(), mainConfig)
    return true
  },
}))()
