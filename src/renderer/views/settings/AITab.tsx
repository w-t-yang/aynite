import { Bot, Plus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import {
  DEFAULT_PROVIDER_MODELS,
  DEFAULT_PROVIDER_URLS,
} from '../../../lib/constants/renderer/ai'
import { ADD_ITEM_BUTTON } from '../../../lib/constants/renderer/styles'
import { config, configMutations } from '../../bridge/config'
import { Button } from '../../shared/basic/Button'
import { Section } from '../../shared/basic/Section'
import { AIProviderCard } from '../../shared/featured/AIProviderCard'
import { SettingsPage } from '../../shared/featured/SettingsPage'
import type { AIProvider, SettingsState } from '../../shared/lib/types'

interface AITabProps {
  onRestore?: () => void
  t: (key: string) => string
}

export function AITab({ onRestore, t }: AITabProps) {
  const [ai, setAI] = useState<SettingsState['ai'] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    config.get('ai').then((resAI: any) => {
      if (resAI) {
        setAI({
          activeId: resAI.activeId,
          providers: resAI.providers || [],
        })
      }
      setLoading(false)
    })
  }, [])

  const saveProviders = useCallback(async (updatedAI: SettingsState['ai']) => {
    setAI(updatedAI)
    await configMutations.set('ai', {
      activeId: updatedAI.activeId,
      providers: updatedAI.providers,
    } as any)
  }, [])

  const handleUpdateProvider = useCallback(
    (id: string, field: string, value: any) => {
      if (!ai) return
      const providers = (ai.providers || []).map((p: AIProvider) => {
        if (p.id !== id) return p

        const updated = {
          ...p,
          [field]:
            field === 'contextWindow' ? parseInt(value, 10) || 8192 : value,
        }

        if (field === 'provider' || field === 'model') {
          if (field === 'provider') {
            updated.model = DEFAULT_PROVIDER_MODELS[value] || updated.model
            updated.baseUrl =
              DEFAULT_PROVIDER_URLS[value] !== undefined
                ? DEFAULT_PROVIDER_URLS[value]
                : updated.baseUrl
          }

          const providerLabel: Record<string, string> = {
            ollama: 'Ollama',
            openai: 'OpenAI',
            anthropic: 'Anthropic',
            gemini: 'Gemini',
            deepseek: 'DeepSeek',
            others: 'Compatible',
          }

          const label = providerLabel[updated.provider] || updated.provider
          updated.name = `${label} - ${updated.model || 'Default'}`
        }

        return updated
      })
      saveProviders({ ...ai, providers })
    },
    [ai, saveProviders],
  )

  const handleSetActiveProvider = useCallback(
    (id: string) => {
      if (!ai) return
      saveProviders({ ...ai, activeId: id })
    },
    [ai, saveProviders],
  )

  const handleAddProvider = useCallback(() => {
    if (!ai) return
    const id = `provider-${Date.now()}`
    const newProvider: AIProvider = {
      id,
      name: t('ai.newProvider'),
      provider: 'openai',
      baseUrl: '',
      apiKey: '',
      model: '',
    }
    const providers = [...(ai.providers || []), newProvider]
    saveProviders({ ...ai, providers, activeId: id })
  }, [ai, saveProviders, t])

  const handleDeleteProvider = useCallback(
    (id: string) => {
      if (!ai) return
      const providers = (ai.providers || []).filter(
        (p: AIProvider) => p.id !== id,
      )
      let activeId = ai.activeId
      if (activeId === id) activeId = providers[0]?.id || ''
      saveProviders({ ...ai, providers, activeId })
    },
    [ai, saveProviders],
  )

  if (loading || !ai) {
    return (
      <SettingsPage title={t('ai.title')} description={t('ai.description')}>
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
          Loading...
        </div>
      </SettingsPage>
    )
  }

  return (
    <SettingsPage
      title={t('ai.title')}
      description={t('ai.description')}
      onRestore={onRestore}
    >
      <Section
        title={t('ai.providers')}
        action={
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAddProvider}
            className={ADD_ITEM_BUTTON}
          >
            <Plus size={14} /> {t('ai.addProvider')}
          </Button>
        }
      >
        <div className="space-y-6">
          {(ai.providers || []).map((provider: AIProvider) => (
            <AIProviderCard
              key={provider.id}
              provider={provider}
              isActive={ai.activeId === provider.id}
              onSetActive={handleSetActiveProvider}
              onUpdate={handleUpdateProvider}
              onDelete={handleDeleteProvider}
            />
          ))}

          {(!ai.providers || ai.providers.length === 0) && (
            <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-border rounded-xl opacity-50">
              <Bot size={48} className="mb-4 text-muted-foreground" />
              <p className="text-sm">{t('ai.noProviders')}</p>
            </div>
          )}
        </div>
      </Section>
    </SettingsPage>
  )
}
