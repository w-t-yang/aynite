import { useMemo } from 'react'
import { loadViewTranslations } from '../../shared/i18n/loadViewI18n'
import { useI18n } from '../../shared/i18n/useI18n'
import { useView } from '../ViewContext'
import viewConfig from './config.json'

export function FlowsView() {
  const { locale } = useView()
  const customTranslations = useMemo(
    () => loadViewTranslations((viewConfig as any).i18n),
    [],
  )
  const { t } = useI18n(locale, customTranslations)

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold text-foreground">{t('title')}</h2>
          <p className="text-sm text-muted-foreground/50">Coming soon...</p>
        </div>
      </div>
    </div>
  )
}
