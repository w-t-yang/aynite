/**
 * Migration script: Moves sessions from date-based directories to flat per-session folders.
 *
 * OLD: workspaces/<name>/sessions/2026-06-19/<id>.json
 *      workspaces/<name>/sessions/2026-06-19/<id>-metadata.json
 *      workspaces/<name>/sessions/2026-06-19/<id>-<timestamp>.json  (compact backup)
 *
 * NEW: workspaces/<name>/sessions/<id>/messages.json
 *      workspaces/<name>/sessions/<id>/metadata.json
 *      workspaces/<name>/sessions/<id>/compacted-<timestamp>.json   (compact backup)
 *
 * Run: npx tsx scripts/migrate-sessions.ts
 */

import { homedir } from 'node:os'
import path from 'node:path'
import { readdir, mkdir, rename, unlink, stat } from 'node:fs/promises'

const AYNITE_DIR = path.join(homedir(), '.aynite')
const WORKSPACES_DIR = path.join(AYNITE_DIR, 'workspaces')

async function main() {
  const workspaces = await readdir(WORKSPACES_DIR).catch(() => [])
  let totalMigrated = 0
  let totalSkipped = 0
  let totalErrors = 0

  for (const ws of workspaces) {
    const sessionsDir = path.join(WORKSPACES_DIR, ws, 'sessions')
    const sessionsDirStat = await stat(sessionsDir).catch(() => null)
    if (!sessionsDirStat || !sessionsDirStat.isDirectory()) continue

    const dateDirs = await readdir(sessionsDir)
    for (const dateDir of dateDirs) {
      const datePath = path.join(sessionsDir, dateDir)
      const dateStat = await stat(datePath).catch(() => null)
      if (!dateStat || !dateStat.isDirectory()) continue

      // Skip if this looks like a session folder (not a date dir)
      // Date dirs look like 2026-06-19, session dirs are timestamp IDs
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateDir)) {
        // This is likely already a session dir from a partial migration
        // or the new flat structure. Skip it.
        continue
      }

      const files = await readdir(datePath)
      // Index all files by session ID
      const sessions = new Map<
        string,
        { messages?: string; metadata?: string; compacted: string[] }
      >()

      for (const file of files) {
        // Parse: <sessionId>.json, <sessionId>-metadata.json, <sessionId>-<timestamp>.json
        const match = file.match(/^(.+?)(-metadata|-(\d{13}))?\.json$/)
        if (!match) continue

        const sessionId = match[1]
        const suffix = match[2]

        if (!sessions.has(sessionId)) {
          sessions.set(sessionId, { compacted: [] })
        }
        const entry = sessions.get(sessionId)!

        if (suffix === '-metadata') {
          entry.metadata = file
        } else if (match[3]) {
          // compact backup: <sessionId>-<timestamp>.json
          entry.compacted.push(file)
        } else {
          entry.messages = file
        }
      }

      // Move each session
      for (const [sessionId, entry] of sessions) {
        if (!entry.messages) {
          // No messages file — skip
          continue
        }

        const sessionDir = path.join(sessionsDir, sessionId)
        await mkdir(sessionDir, { recursive: true }).catch(() => {})

        try {
          // Move messages.json
          const oldMessages = path.join(datePath, entry.messages!)
          const newMessages = path.join(sessionDir, 'messages.json')
          await rename(oldMessages, newMessages)

          // Move metadata.json if it exists
          if (entry.metadata) {
            const oldMeta = path.join(datePath, entry.metadata)
            const newMeta = path.join(sessionDir, 'metadata.json')
            await rename(oldMeta, newMeta)
          }

          // Move compact backups
          for (const compactFile of entry.compacted) {
            const ts = compactFile.match(/-(\d{13})\.json$/)?.[1]
            if (ts) {
              const oldCompact = path.join(datePath, compactFile)
              const newCompact = path.join(sessionDir, `compacted-${ts}.json`)
              await rename(oldCompact, newCompact)
            }
          }

          totalMigrated++
        } catch (err) {
          console.error(
            `[ERROR] Failed to migrate session "${sessionId}" from "${dateDir}":`,
            err,
          )
          totalErrors++
        }
      }

      // Remove empty date directory
      const remaining = await readdir(datePath).catch(() => [])
      if (remaining.length === 0) {
        await unlink(datePath).catch(() => {})
      } else {
        console.warn(
          `[WARN] Date dir "${dateDir}" in workspace "${ws}" still has ${remaining.length} files, not removing`,
        )
        totalSkipped += remaining.length
      }
    }
  }

  console.log('\n--- Migration complete ---')
  console.log(`Migrated: ${totalMigrated} sessions`)
  console.log(`Errors:   ${totalErrors}`)
  console.log(`Skipped:  ${totalSkipped} files left in date dirs (unrecognized)`)
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
