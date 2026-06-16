/**
 * Helper for views to load i18n translations from their config.json.
 *
 * View config.json can have an `i18n` section with hierarchical keys:
 * {
 *   "i18n": {
 *     "zh": {
 *       "sidebar": { "basic": "基本", "appearance": "外观" },
 *       "loading": "正在加载..."
 *     }
 *   }
 * }
 *
 * This function flattens the hierarchical structure into the flat format
 * that useI18n expects: Record<string, { en: string; zh: string }>
 */

import type { Locale } from '../../../lib/types/ui'

type TranslationValue = string | Record<string, unknown>

/**
 * Flatten a hierarchical i18n object into flat key-value pairs.
 * E.g., { sidebar: { basic: "基本" } } → { "sidebar.basic": "基本" }
 */
function flattenTranslations(
  obj: Record<string, TranslationValue>,
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
        flattenTranslations(value as Record<string, TranslationValue>, fullKey),
      )
    }
  }
  return result
}

/**
 * Convert a raw i18n config section (e.g., the "zh" object from view config)
 * into the flat format used by useI18n.
 *
 * Input:  { zh: { sidebar: { basic: "基本" } } }
 * Output: { "sidebar.basic": { en: "sidebar.basic", zh: "基本" } }
 */
export function loadViewTranslations(
  rawI18n: Record<string, Record<string, TranslationValue>> | undefined,
): Record<string, { en: string; zh: string }> {
  const result: Record<string, { en: string; zh: string }> = {}

  if (!rawI18n) return result

  for (const locale of ['en', 'zh'] as Locale[]) {
    const localeData = rawI18n[locale]
    if (!localeData) continue

    const flattened = flattenTranslations(
      localeData as Record<string, TranslationValue>,
    )
    for (const [key, value] of Object.entries(flattened)) {
      if (!result[key]) {
        result[key] = { en: key, zh: key }
      }
      result[key][locale] = value
    }
  }

  return result
}
