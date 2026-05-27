import { describe, expect, it } from 'vitest'
import type { HunkData } from '../../../src/main/git/porcelain'
import {
  buildHunkPatch,
  mapCodeToStatus,
  parseNumstat,
  parsePorcelain,
} from '../../../src/main/git/porcelain'

// ─── mapCodeToStatus ────────────────────────────────────────────────────

describe('mapCodeToStatus', () => {
  it('maps " M" (working tree modified) to "modified"', () => {
    expect(mapCodeToStatus(' M')).toBe('modified')
  })

  it('maps "M " (staged modified) to "modified"', () => {
    expect(mapCodeToStatus('M ')).toBe('modified')
  })

  it('maps "??" (untracked) to "untracked"', () => {
    expect(mapCodeToStatus('??')).toBe('untracked')
  })

  it('maps "!!" (ignored) to "ignored"', () => {
    expect(mapCodeToStatus('!!')).toBe('ignored')
  })

  it('maps "A " (added) to "added"', () => {
    expect(mapCodeToStatus('A ')).toBe('added')
  })

  it('maps "D " (deleted) to "deleted"', () => {
    expect(mapCodeToStatus('D ')).toBe('deleted')
  })

  it('maps "AD" (staged add, working tree delete) — uses X (staging) status', () => {
    // The code uses X (staging area) as the primary status when set.
    // AD means staged as Added, then modified (Deleted) in working tree.
    // Current behavior reports the staged status.
    expect(mapCodeToStatus('AD')).toBe('added')
  })

  it('maps "R " (renamed) to "renamed"', () => {
    expect(mapCodeToStatus('R ')).toBe('renamed')
  })

  it('maps "C " (copied) to "renamed"', () => {
    expect(mapCodeToStatus('C ')).toBe('renamed')
  })

  it('maps "  " (unchanged) to "none"', () => {
    expect(mapCodeToStatus('  ')).toBe('none')
  })

  it('maps "MM" (staged and unstaged modified) to "modified"', () => {
    expect(mapCodeToStatus('MM')).toBe('modified')
  })
})

// ─── buildHunkPatch ─────────────────────────────────────────────────────

describe('buildHunkPatch', () => {
  it('builds a valid unified diff patch string', () => {
    const hunk: HunkData = {
      filePath: '/repo/src/file.ts',
      oldStart: 10,
      oldLines: ['line A', 'line B'],
      newStart: 10,
      newLines: ['line A modified', 'line B'],
    }

    const result = buildHunkPatch('src/file.ts', hunk)

    expect(result).toContain('--- a/src/file.ts')
    expect(result).toContain('+++ b/src/file.ts')
    expect(result).toContain('@@ -10,2 +10,2 @@')
    expect(result).toContain('-line A')
    expect(result).toContain('+line A modified')
    expect(result).toContain('-line B')
    expect(result).toContain('+line B')
  })

  it('handles additions (no old lines)', () => {
    const hunk: HunkData = {
      filePath: '/repo/src/new.ts',
      oldStart: 0,
      oldLines: [],
      newStart: 1,
      newLines: ['added line 1', 'added line 2'],
    }

    const result = buildHunkPatch('src/new.ts', hunk)

    expect(result).toContain('@@ -0,0 +1,2 @@')
    // No removed lines (lines prefixed with - but excluding the --- header)
    expect(
      result
        .split('\n')
        .filter((l) => l.startsWith('-') && !l.startsWith('---')),
    ).toHaveLength(0)
    expect(result).toContain('+added line 1')
    expect(result).toContain('+added line 2')
  })

  it('handles deletions (no new lines)', () => {
    const hunk: HunkData = {
      filePath: '/repo/src/old.ts',
      oldStart: 5,
      oldLines: ['remove me'],
      newStart: 5,
      newLines: [],
    }

    const result = buildHunkPatch('src/old.ts', hunk)

    expect(result).toContain('@@ -5,1 +5,0 @@')
    expect(result).toContain('-remove me')
    // No added lines (lines prefixed with + but excluding the +++ header)
    expect(
      result
        .split('\n')
        .filter((l) => l.startsWith('+') && !l.startsWith('+++')),
    ).toHaveLength(0)
  })
})

// ─── parsePorcelain ─────────────────────────────────────────────────────

describe('parsePorcelain', () => {
  it('parses a single modified file', () => {
    const stdout = ' M src/file.ts\n'
    const root = '/repo'

    const result = parsePorcelain(stdout, root)

    expect(result).toEqual({
      '/repo/src/file.ts': 'modified',
      '/repo/src': 'modified',
      '/repo': 'modified',
    })
  })

  it('parses multiple files with mixed statuses', () => {
    const stdout = ' M src/file.ts\n?? untracked.txt\nA  src/new.ts\n'
    const root = '/repo'

    const result = parsePorcelain(stdout, root)

    expect(result['/repo/src/file.ts']).toBe('modified')
    expect(result['/repo/untracked.txt']).toBe('untracked')
    expect(result['/repo/src/new.ts']).toBe('added')
  })

  it('handles renamed files (R  old -> new)', () => {
    const stdout = 'R  old.ts -> new.ts\n'
    const root = '/repo'

    const result = parsePorcelain(stdout, root)

    expect(result).toHaveProperty('/repo/new.ts')
    expect(result['/repo/new.ts']).toBe('renamed')
    expect(result).not.toHaveProperty('/repo/old.ts')
  })

  it('handles quoted file paths with spaces', () => {
    const stdout = ' M "src/my file.ts"\n'
    const root = '/repo'

    const result = parsePorcelain(stdout, root)

    expect(result).toHaveProperty('/repo/src/my file.ts')
    expect(result['/repo/src/my file.ts']).toBe('modified')
  })

  it('normalizes trailing slashes', () => {
    const stdout = '?? dir/\n'
    const root = '/repo'

    const result = parsePorcelain(stdout, root)

    expect(result).toHaveProperty('/repo/dir')
    expect(result['/repo/dir']).toBe('untracked')
  })

  it('propagates status to parent directories', () => {
    const stdout = ' M src/deep/nested/file.ts\n'
    const root = '/repo'

    const result = parsePorcelain(stdout, root)

    expect(result['/repo/src/deep/nested/file.ts']).toBe('modified')
    expect(result['/repo/src/deep/nested']).toBe('modified')
    expect(result['/repo/src/deep']).toBe('modified')
    expect(result['/repo/src']).toBe('modified')
    expect(result['/repo']).toBe('modified')
  })

  it('does not propagate status beyond root boundary', () => {
    const stdout = ' M src/file.ts\n'
    const root = '/repo'

    const result = parsePorcelain(stdout, root)

    // Should NOT have / (root of filesystem)
    expect(result).not.toHaveProperty('/')
  })

  it('does not propagate ignored status', () => {
    const stdout = '!! .DS_Store\n'
    const root = '/repo'

    const result = parsePorcelain(stdout, root)

    expect(result['/repo/.DS_Store']).toBe('ignored')
    // Parent should NOT be marked as modified for ignored files
    expect(result['/repo']).toBeUndefined()
  })

  it('returns empty map for empty input', () => {
    expect(parsePorcelain('', '/repo')).toEqual({})
  })

  it('skips lines shorter than 3 characters', () => {
    expect(parsePorcelain(' M\n', '/repo')).toEqual({})
  })

  it('handles unicode filenames', () => {
    const stdout = ' M café/file.ts\n'
    const root = '/repo'

    const result = parsePorcelain(stdout, root)

    expect(result['/repo/café/file.ts']).toBe('modified')
  })
})

// ─── parseNumstat ───────────────────────────────────────────────────────

describe('parseNumstat', () => {
  it('parses additions and deletions for a single file', () => {
    const stdout = '3\t2\tsrc/file.ts\n'
    const root = '/repo'

    const result = parseNumstat(stdout, root)

    expect(result['/repo/src/file.ts']).toEqual({
      additions: 3,
      deletions: 2,
    })
  })

  it('parses multiple files', () => {
    const stdout = '1\t0\tsrc/a.ts\n5\t3\tsrc/b.ts\n'
    const root = '/repo'

    const result = parseNumstat(stdout, root)

    expect(result['/repo/src/a.ts']).toEqual({ additions: 1, deletions: 0 })
    expect(result['/repo/src/b.ts']).toEqual({ additions: 5, deletions: 3 })
  })

  it('handles binary files (- in place of numbers)', () => {
    const stdout = '-\t-\timage.png\n'
    const root = '/repo'

    const result = parseNumstat(stdout, root)

    expect(result['/repo/image.png']).toEqual({ additions: 0, deletions: 0 })
  })

  it('handles quoted file paths with spaces', () => {
    const stdout = '1\t1\t"my file.ts"\n'
    const root = '/repo'

    const result = parseNumstat(stdout, root)

    expect(result['/repo/my file.ts']).toEqual({ additions: 1, deletions: 1 })
  })

  it('returns empty object for empty input', () => {
    expect(parseNumstat('', '/repo')).toEqual({})
  })

  it('skips malformed lines with fewer than 3 tab-separated parts', () => {
    const stdout = '1\t2\n'
    const root = '/repo'

    const result = parseNumstat(stdout, root)

    expect(result).toEqual({})
  })
})
