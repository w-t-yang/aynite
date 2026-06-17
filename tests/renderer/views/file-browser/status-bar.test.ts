// @vitest-environment node
import { describe, expect, it } from 'vitest'

/**
 * Tests for pure logic extracted from StatusBar.tsx:
 * - wordCount: number of whitespace-separated tokens in content
 * - lineCount: number of newline-separated lines in content
 */

// ─── Extracted pure logic from StatusBar ───────────────────────────────

function computeWordCount(content: string | null): number {
  return content ? content.trim().split(/\s+/).length : 0
}

function computeLineCount(content: string | null): number {
  return content ? content.split('\n').length : 0
}

// ─── Tests: wordCount ──────────────────────────────────────────────────

describe('computeWordCount', () => {
  it('returns 0 for null content', () => {
    expect(computeWordCount(null)).toBe(0)
  })

  it('returns 0 for empty string', () => {
    expect(computeWordCount('')).toBe(0)
  })

  it('counts words in simple text', () => {
    expect(computeWordCount('hello world')).toBe(2)
  })

  it('counts words in multi-line text', () => {
    expect(computeWordCount('hello\nworld\nfoo bar')).toBe(4)
  })

  it('handles extra whitespace', () => {
    expect(computeWordCount('  hello   world  ')).toBe(2)
  })

  it('handles single word', () => {
    expect(computeWordCount('hello')).toBe(1)
  })
})

// ─── Tests: lineCount ──────────────────────────────────────────────────

describe('computeLineCount', () => {
  it('returns 0 for null content', () => {
    expect(computeLineCount(null)).toBe(0)
  })

  it('returns 0 for empty string', () => {
    expect(computeLineCount('')).toBe(0)
  })

  it('counts lines in single-line text', () => {
    expect(computeLineCount('hello world')).toBe(1)
  })

  it('counts lines in multi-line text', () => {
    expect(computeLineCount('line1\nline2\nline3')).toBe(3)
  })

  it('counts lines with trailing newline', () => {
    // split('\n') of "a\nb\n" gives ["a", "b", ""] → 3
    expect(computeLineCount('a\nb\n')).toBe(3)
  })

  it('counts lines in code content', () => {
    const code = `function hello() {
  return 'world'
}`
    expect(computeLineCount(code)).toBe(3)
  })
})
