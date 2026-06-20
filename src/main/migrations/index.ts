import { readJson, writeJson } from '../../lib/path'
import { getMainConfigPath } from '../../lib/path/resolve'

interface Migration {
  version: string
  migrate: () => Promise<void>
}

/**
 * Compares two semver strings. Returns negative if a < b, positive if a > b, 0 if equal.
 */
function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number)
  const partsB = b.split('.').map(Number)
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const va = partsA[i] ?? 0
    const vb = partsB[i] ?? 0
    if (va !== vb) return va - vb
  }
  return 0
}

/**
 * Runs any pending migrations in order.
 *
 * 1. Reads the current `migrationVersion` from the main config.
 * 2. Discovers all migration modules (files matching `v*.ts` in the migrations dir).
 * 3. Sorts them by version.
 * 4. Runs each migration whose version > last applied version.
 * 5. Updates `migrationVersion` in the main config after each successful migration.
 *
 * Migrations are idempotent — the version check ensures each runs exactly once.
 */
export async function runMigrations(): Promise<void> {
  // Read current migration version from config
  const mainConfig = await readJson<Record<string, unknown>>(
    getMainConfigPath(),
    {},
  )
  const lastVersion = (mainConfig.migrationVersion as string) || '0.0.0'

  // Dynamically discover all migration modules
  const migrations: Migration[] = []

  // Import all known migrations
  // New migrations should be registered here in the order they should run
  const knownMigrations: Migration[] = [
    await import('./v0.1.0'),
    await import('./v0.1.11'),
  ]

  for (const mod of knownMigrations) {
    if (typeof mod.version === 'string' && typeof mod.migrate === 'function') {
      migrations.push({ version: mod.version, migrate: mod.migrate })
    }
  }

  // Sort by version (ascending)
  migrations.sort((a, b) => compareVersions(a.version, b.version))

  // Run pending migrations
  for (const migration of migrations) {
    if (compareVersions(migration.version, lastVersion) > 0) {
      console.log(`[migrations] Running v${migration.version}...`)
      try {
        await migration.migrate()
        // Update last applied version
        mainConfig.migrationVersion = migration.version
        await writeJson(getMainConfigPath(), mainConfig)
        console.log(`[migrations] v${migration.version} complete.`)
      } catch (e) {
        console.error(`[migrations] v${migration.version} failed:`, e)
        // Don't update version on failure — will retry next startup
        throw e
      }
    }
  }
}
