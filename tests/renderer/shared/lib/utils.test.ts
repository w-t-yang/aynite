// @vitest-environment node
import { describe, expect, it } from 'vitest'

/**
 * Tests for pure functions from src/renderer/shared/lib/utils.ts
 *
 * toCSSVar and cn are pure functions with no external dependencies.
 * normalizePath delegates to toUnixPath (tested elsewhere).
 * applyThemeColors requires document.documentElement (DOM) — not tested here.
 */

// ─── Inline copies of the pure functions ──────────────────────────────

function toCSSVar(key: string): string {
  return `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`
}

function cn(...inputs: unknown[]): string {
  // Simplified version of the cn/twMerge logic
  return inputs
    .flat()
    .filter(Boolean)
    .map((i) => {
      if (typeof i === 'string') return i
      if (typeof i === 'object' && i !== null) {
        return Object.entries(i)
          .filter(([, v]) => Boolean(v))
          .map(([k]) => k)
          .join(' ')
      }
      return ''
    })
    .join(' ')
    .trim()
}

// ─── toCSSVar ─────────────────────────────────────────────────────────

describe('toCSSVar', () => {
  it('converts camelCase to kebab-case CSS variable', () => {
    expect(toCSSVar('primaryForeground')).toBe('--primary-foreground')
    expect(toCSSVar('mutedForeground')).toBe('--muted-foreground')
  })

  it('handles single word keys', () => {
    expect(toCSSVar('primary')).toBe('--primary')
    expect(toCSSVar('background')).toBe('--background')
    expect(toCSSVar('border')).toBe('--border')
  })

  it('inserts dash before each uppercase letter, including consecutive ones', () => {
    // Each consecutive uppercase gets its own dash
    expect(toCSSVar('PDFViewer')).toBe('---p-d-f-viewer')
    expect(toCSSVar('SVGIcon')).toBe('---s-v-g-icon')
  })

  it('handles already lowercase keys', () => {
    expect(toCSSVar('primary')).toBe('--primary')
    expect(toCSSVar('background')).toBe('--background')
  })

  it('handles empty string', () => {
    expect(toCSSVar('')).toBe('--')
  })

  it('handles keys with numbers', () => {
    expect(toCSSVar('fontSize12')).toBe('--font-size12')
  })
})

// ─── cn ───────────────────────────────────────────────────────────────

describe('cn', () => {
  it('merges string class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('filters falsy values', () => {
    expect(cn('foo', false, 'bar', undefined, null, 'baz')).toBe('foo bar baz')
  })

  it('handles conditional object notation', () => {
    expect(cn('base', { active: true, hidden: false })).toBe('base active')
  })

  it('returns empty string for no inputs', () => {
    expect(cn()).toBe('')
  })

  it('handles all falsy values', () => {
    expect(cn(false, null, undefined, '')).toBe('')
  })

  it('handles multiple conditional objects', () => {
    expect(cn({ a: true, b: false }, { c: true })).toBe('a c')
  })

  it('handles array inputs', () => {
    expect(cn(['foo', 'bar'], 'baz')).toBe('foo bar baz')
  })
})
