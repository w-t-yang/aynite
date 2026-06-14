/**
 * Shared i18n hook for the main renderer.
 *
 * Usage:
 *   const { t } = useI18n()
 *   <span>{t('theme.label')}</span>
 *
 * For views loaded at runtime, they can use this hook with a locale
 * from ViewContext and custom translations loaded from their config.json.
 */

import { useCallback } from 'react'
import { translations } from './translations'

export type Locale = 'en' | 'zh'

const FALLBACK_LOCALE: Locale = 'en'

/**
 * Resolve a translation key for the given locale.
 * Falls back to English if the key or locale variant is missing.
 */
export function resolveTranslation(
  key: string,
  locale: Locale,
  customTranslations?: Record<string, { en: string; zh: string }>,
): string {
  // Check custom translations first (for views)
  if (customTranslations?.[key]) {
    const entry = customTranslations[key]
    return entry[locale] || entry[FALLBACK_LOCALE] || key
  }

  // Check shared translations
  const entry = translations[key]
  if (!entry) return key // fallback: return the key itself

  return entry[locale] || entry[FALLBACK_LOCALE] || key
}

/**
 * Hook that returns a `t()` function for the given locale.
 * Views can pass custom translations loaded from their config.json.
 */
export function useI18n(
  locale: Locale,
  customTranslations?: Record<string, { en: string; zh: string }>,
) {
  const t = useCallback(
    (key: string): string => {
      return resolveTranslation(key, locale, customTranslations)
    },
    [locale, customTranslations],
  )

  return { t, locale }
}
