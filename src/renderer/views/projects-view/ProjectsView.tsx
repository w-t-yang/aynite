import { FolderOpen } from 'lucide-react'
import { useMemo } from 'react'
import { ViewHeader } from '../../shared/basic/ViewHeader'
import { loadViewTranslations } from '../../shared/i18n/loadViewI18n'
import { useI18n } from '../../shared/i18n/useI18n'
import { useView } from '../ViewContext'
import viewConfig from './config.json'

export function ProjectsView() {
  const { locale } = useView()
  const customTranslations = useMemo(
    () => loadViewTranslations((viewConfig as any).i18n),
    [],
  )
  const { t } = useI18n(locale, customTranslations)

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <ViewHeader icon={<FolderOpen size={16} />} title={t('title')} />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md px-6">
          <FolderOpen size={48} className="mx-auto text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground/60 leading-relaxed">
            {t('placeholder')}
          </p>
        </div>
      </div>
    </div>
  )
}
