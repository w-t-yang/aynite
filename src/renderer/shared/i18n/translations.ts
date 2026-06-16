/**
 * Shared i18n translation dictionary for the main renderer.
 *
 * Views have their own translations in their config.json `i18n` fields.
 * This file is for strings in the main renderer shell (TitleBar, contexts, etc.).
 *
 * Key naming convention: `section.key` for namespaced access.
 * Values are simple string maps: en and zh.
 *
 * The data lives in src/lib/constants/renderer/translations.ts to satisfy
 * the constants isolation audit rule.
 */

export { translations } from '../../../lib/constants/renderer/translations'
