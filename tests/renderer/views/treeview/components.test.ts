// @vitest-environment node
import { describe, expect, it } from 'vitest'

/**
 * Tests for pure logic extracted from treeview/components.tsx:
 * 1. statusLabel — maps GitStatusType to display letter and color class
 * 2. diffStat — formats addition/deletion counts
 */

// ─── Extracted pure logic from NodeRenderer ────────────────────────────

type GitStatusType = 'modified' | 'added' | 'untracked' | 'deleted' | 'renamed'

interface StatusLabel {
  letter: string
  className: string
}

function getGitStatusLabel(
  gitStatus: GitStatusType | undefined,
): StatusLabel | null {
  switch (gitStatus) {
    case 'modified':
      return { letter: 'M', className: 'text-amber-400' }
    case 'added':
      return { letter: 'A', className: 'text-green-400' }
    case 'untracked':
      return { letter: 'U', className: 'text-blue-400' }
    case 'deleted':
      return { letter: 'D', className: 'text-red-400' }
    case 'renamed':
      return { letter: 'R', className: 'text-purple-400' }
    default:
      return null
  }
}

interface DiffStats {
  additions: number
  deletions: number
}

interface FormattedDiffStat {
  additions: number
  deletions: number
  hasAdditions: boolean
  hasDeletions: boolean
}

function getDiffStatInfo(
  diffStat: DiffStats | undefined,
): FormattedDiffStat | null {
  if (!diffStat) return null
  return {
    additions: diffStat.additions,
    deletions: diffStat.deletions,
    hasAdditions: diffStat.additions > 0,
    hasDeletions: diffStat.deletions > 0,
  }
}

// ─── Tests: statusLabel ────────────────────────────────────────────────

describe('getGitStatusLabel', () => {
  it('maps modified to M with amber color', () => {
    const result = getGitStatusLabel('modified')
    expect(result).toEqual({ letter: 'M', className: 'text-amber-400' })
  })

  it('maps added to A with green color', () => {
    const result = getGitStatusLabel('added')
    expect(result).toEqual({ letter: 'A', className: 'text-green-400' })
  })

  it('maps untracked to U with blue color', () => {
    const result = getGitStatusLabel('untracked')
    expect(result).toEqual({ letter: 'U', className: 'text-blue-400' })
  })

  it('maps deleted to D with red color', () => {
    const result = getGitStatusLabel('deleted')
    expect(result).toEqual({ letter: 'D', className: 'text-red-400' })
  })

  it('maps renamed to R with purple color', () => {
    const result = getGitStatusLabel('renamed')
    expect(result).toEqual({ letter: 'R', className: 'text-purple-400' })
  })

  it('returns null for undefined status', () => {
    expect(getGitStatusLabel(undefined)).toBeNull()
  })
})

// ─── Tests: diffStat ───────────────────────────────────────────────────

describe('getDiffStatInfo', () => {
  it('returns additions and deletions when both present', () => {
    const result = getDiffStatInfo({ additions: 5, deletions: 3 })
    expect(result).not.toBeNull()
    expect(result?.additions).toBe(5)
    expect(result?.deletions).toBe(3)
    expect(result?.hasAdditions).toBe(true)
    expect(result?.hasDeletions).toBe(true)
  })

  it('handles additions only', () => {
    const result = getDiffStatInfo({ additions: 5, deletions: 0 })
    expect(result).not.toBeNull()
    expect(result?.hasAdditions).toBe(true)
    expect(result?.hasDeletions).toBe(false)
  })

  it('handles deletions only', () => {
    const result = getDiffStatInfo({ additions: 0, deletions: 3 })
    expect(result).not.toBeNull()
    expect(result?.hasAdditions).toBe(false)
    expect(result?.hasDeletions).toBe(true)
  })

  it('handles zero additions and deletions', () => {
    const result = getDiffStatInfo({ additions: 0, deletions: 0 })
    expect(result).not.toBeNull()
    expect(result?.hasAdditions).toBe(false)
    expect(result?.hasDeletions).toBe(false)
  })

  it('returns null for undefined diffStat', () => {
    expect(getDiffStatInfo(undefined)).toBeNull()
  })
})
