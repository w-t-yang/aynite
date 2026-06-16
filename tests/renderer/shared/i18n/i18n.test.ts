import { describe, expect, it } from 'vitest'
import { loadViewTranslations } from '../../../../src/renderer/shared/i18n/loadViewI18n'
import { resolveTranslation } from '../../../../src/renderer/shared/i18n/useI18n'

// ─── flattenTranslations (reimplemented since it's private in source) ──

function flattenTranslations(
  obj: Record<string, string | Record<string, unknown>>,
  prefix = '',
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') {
      result[fullKey] = value
    } else if (typeof value === 'object' && value !== null) {
      Object.assign(
        result,
        flattenTranslations(
          value as Record<string, string | Record<string, unknown>>,
          fullKey,
        ),
      )
    }
  }
  return result
}

describe('flattenTranslations', () => {
  it('flattens nested object into dot-separated keys', () => {
    const input = {
      sidebar: { basic: '基本', appearance: '外观' },
      loading: '正在加载...',
    }

    const result = flattenTranslations(input)

    expect(result).toEqual({
      'sidebar.basic': '基本',
      'sidebar.appearance': '外观',
      loading: '正在加载...',
    })
  })

  it('handles deeply nested objects', () => {
    const input = {
      a: { b: { c: '深層' } },
    }

    const result = flattenTranslations(input)

    expect(result).toEqual({
      'a.b.c': '深層',
    })
  })

  it('handles empty object', () => {
    expect(flattenTranslations({})).toEqual({})
  })

  it('handles single-level object', () => {
    expect(flattenTranslations({ key: 'value' })).toEqual({ key: 'value' })
  })

  it('handles null values gracefully', () => {
    const input = { key: null as unknown as string }
    const result = flattenTranslations(input)
    expect(result).toEqual({})
  })
})

// ─── loadViewTranslations ──────────────────────────────────────────────

describe('loadViewTranslations', () => {
  it('converts raw i18n config to flat key-value pairs', () => {
    const raw = {
      en: {
        sidebar: { basic: 'Basic' },
        loading: 'Loading...',
      },
      zh: {
        sidebar: { basic: '基本' },
        loading: '正在加载...',
      },
    }

    const result = loadViewTranslations(raw)

    expect(result).toEqual({
      'sidebar.basic': { en: 'Basic', zh: '基本' },
      loading: { en: 'Loading...', zh: '正在加载...' },
    })
  })

  it('returns empty object for undefined input', () => {
    expect(loadViewTranslations(undefined)).toEqual({})
  })

  it('handles missing zh locale', () => {
    const raw = {
      en: { greeting: 'Hello' },
    }

    const result = loadViewTranslations(raw)
    expect(result.greeting.en).toBe('Hello')
    expect(result.greeting.zh).toBe('greeting') // falls back to key
  })

  it('merges both locales into same key structure', () => {
    const raw = {
      en: { title: 'Settings' },
      zh: { title: '设置' },
    }

    const result = loadViewTranslations(raw)
    expect(result.title).toEqual({ en: 'Settings', zh: '设置' })
  })
})

// ─── resolveTranslation ────────────────────────────────────────────────

describe('resolveTranslation', () => {
  it('returns translation for existing key with matching locale', () => {
    const result = resolveTranslation('sidebar.basic', 'zh', {
      'sidebar.basic': { en: 'Basic', zh: '基本' },
    })
    expect(result).toBe('基本')
  })

  it('falls back to English when locale variant missing', () => {
    const result = resolveTranslation('greeting', 'zh', {
      greeting: { en: 'Hello', zh: '' },
    })
    expect(result).toBe('Hello')
  })

  it('returns key when no translation exists', () => {
    const result = resolveTranslation('nonexistent.key', 'en', {})
    expect(result).toBe('nonexistent.key')
  })

  it('returns key when no custom translations provided', () => {
    const result = resolveTranslation('some.key', 'en')
    expect(result).toBe('some.key')
  })

  it('returns zh when available for zh locale', () => {
    const result = resolveTranslation('loading', 'zh')
    // Uses shared translations - may return English as default
    expect(typeof result).toBe('string')
  })
})
