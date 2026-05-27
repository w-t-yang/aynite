/**
 * Pure functions for git porcelain parsing and hunk patch building.
 * Extracted from GitService for testability.
 */
import { getDirname, joinPaths } from '../../lib/path'
import type { DiffStats, GitStatusType } from '../../lib/types/files'

// ─── Status Parsing ─────────────────────────────────────────────────────

/**
 * Maps a 2-character git status code to a GitStatusType.
 *
 * Porcelain format: XY
 *   X = staging area status
 *   Y = working tree status
 *
 * @see https://git-scm.com/docs/git-status#_output
 */
export function mapCodeToStatus(code: string): GitStatusType {
  const X = code[0]
  const Y = code[1]

  if (X === '?' && Y === '?') return 'untracked'
  if (X === '!' && Y === '!') return 'ignored'
  if (X === 'A') return 'added'
  if (X === 'M' || Y === 'M') return 'modified'
  if (X === 'D' || Y === 'D') return 'deleted'
  if (X === 'R') return 'renamed'
  if (X === 'C') return 'renamed'

  return 'none'
}

/**
 * Parses the output of `git status --porcelain` into a map of
 * absolute file paths to their status types.
 *
 * Also propagates status to parent directory paths so that
 * tree views can show "modified" indicators on containing folders.
 */
export function parsePorcelain(stdout: string, root: string): GitStatusMap {
  const statusMap: GitStatusMap = {}
  const lines = stdout.split('\n')

  for (const line of lines) {
    if (!line || line.length < 3) continue
    const code = line.slice(0, 2)
    let filePath = line.slice(3)

    // Handle renames: "R  old -> new"
    if (code.startsWith('R')) {
      filePath = filePath.split(' -> ').pop() || filePath
    }

    // Remove quotes if present
    if (filePath.startsWith('"') && filePath.endsWith('"')) {
      filePath = filePath.slice(1, -1)
    }

    // Normalize trailing slashes
    if (filePath.endsWith('/') || filePath.endsWith('\\')) {
      filePath = filePath.slice(0, -1)
    }

    const status = mapCodeToStatus(code)
    const absPath = joinPaths(root, filePath)
    statusMap[absPath] = status

    // Propagate to parents
    if (status !== 'ignored' && status !== 'none') {
      let parent = getDirname(absPath)
      while (
        parent &&
        parent.length >= root.length &&
        parent.startsWith(root)
      ) {
        if (!statusMap[parent] || statusMap[parent] === 'none') {
          statusMap[parent] = 'modified'
        }
        const nextParent = getDirname(parent)
        if (nextParent === parent) break
        parent = nextParent
      }
    }
  }

  return statusMap
}

export interface GitStatusMap {
  [path: string]: GitStatusType
}

// ─── Hunk Patch Building ────────────────────────────────────────────────

export interface HunkData {
  filePath: string
  oldStart: number
  oldLines: string[]
  newStart: number
  newLines: string[]
}

/**
 * Builds a unified diff patch string for a single hunk.
 * Used for stage and discard operations.
 */
export function buildHunkPatch(relative: string, hunk: HunkData): string {
  const oldCount = hunk.oldLines.length
  const newCount = hunk.newLines.length
  const parts: string[] = [
    `--- a/${relative}`,
    `+++ b/${relative}`,
    `@@ -${hunk.oldStart},${oldCount} +${hunk.newStart},${newCount} @@`,
  ]
  for (const l of hunk.oldLines) parts.push(`-${l}`)
  for (const l of hunk.newLines) parts.push(`+${l}`)
  parts.push('')
  return parts.join('\n')
}

// ─── Diff Stats Parsing ─────────────────────────────────────────────────

/**
 * Parses `git diff --numstat` output into a map of file paths to
 * addition/deletion counts.
 */
export function parseNumstat(
  stdout: string,
  root: string,
): Record<string, DiffStats> {
  const result: Record<string, DiffStats> = {}
  for (const line of stdout.split('\n')) {
    if (!line.trim()) continue
    const parts = line.split('\t')
    if (parts.length < 3) continue
    const addStr = parts[0]
    const delStr = parts[1]
    let filePath = parts.slice(2).join('\t')
    if (filePath.startsWith('"') && filePath.endsWith('"')) {
      filePath = filePath.slice(1, -1)
    }
    const absPath = joinPaths(root, filePath)
    result[absPath] = {
      additions: addStr === '-' ? 0 : parseInt(addStr, 10) || 0,
      deletions: delStr === '-' ? 0 : parseInt(delStr, 10) || 0,
    }
  }
  return result
}
