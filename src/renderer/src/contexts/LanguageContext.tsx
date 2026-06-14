/**
 * Language Context — i18n state management for the main renderer.
 *
 * Follows the RFC-003 event-driven pattern:
 * - `setLocale` only fires the IPC call (returns void) — no optimistic state update
 * - State updates come through the LANGUAGE_CHANGED event from AppContext's router
 *
 * AppContext calls `languageActionsRef.current?.setLocale(newLocale)` when the
 * LANGUAGE_CHANGED event arrives from the main process.
 */
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { config, configMutations } from '../../bridge/config'
import type { Locale } from '../../shared/i18n/useI18n'

export interface LanguageActions {
  setLocale: (locale: Locale) => Promise<void>
}

interface LanguageContextType {
  locale: Locale
  setLocale: (locale: Locale) => Promise<void>
  /** Exposed so AppContext single router can call event-driven updates */
  actionsRef: React.MutableRefObject<LanguageActions | null>
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined,
)

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [locale, setLocaleState] = useState<Locale>('en')
  const actionsRef = useRef<LanguageActions | null>(null)

  // Load initial language from config
  useEffect(() => {
    config
      .get('language')
      .then((lang: string) => {
        if (lang === 'zh' || lang === 'en') {
          setLocaleState(lang)
        }
      })
      .catch(() => {})
  }, [])

  // Keep actions ref in sync so AppContext can call it
  useEffect(() => {
    actionsRef.current = {
      setLocale: async (newLocale: Locale) => {
        setLocaleState(newLocale)
      },
    }
  }, [])

  // Setter: fire-and-forget IPC — state update comes through event
  const setLocale = useCallback(async (newLocale: Locale) => {
    await configMutations.set('language', newLocale)
    // Don't update locale state here — LANGUAGE_CHANGED event will trigger it
  }, [])

  return (
    <LanguageContext.Provider value={{ locale, setLocale, actionsRef }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
