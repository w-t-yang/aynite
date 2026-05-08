import { Bot, Plus } from 'lucide-react'
import {
  DEFAULT_PROVIDER_MODELS,
  DEFAULT_PROVIDER_URLS,
} from '../../../lib/constants/renderer/ai'
import { ADD_ITEM_BUTTON } from '../../../lib/constants/renderer/styles'
import { Button } from '../../shared/basic/Button'
import { Section } from '../../shared/basic/Section'
import { AIProviderCard } from '../../shared/featured/AIProviderCard'
import { SettingsPage } from '../../shared/featured/SettingsPage'
import type { AIProvider, SettingsState } from '../../shared/lib/types'

interface AITabProps {
  state: {
    ai: SettingsState['ai']
  }
  actions: {
    setAI: (ai: SettingsState['ai']) => void
    onRestore?: () => void
  }
}

export function AITab({ state, actions }: AITabProps) {
  const { ai } = state
  const { setAI } = actions

  const handleUpdateProvider = (id: string, field: string, value: any) => {
    const providers = (ai.providers || []).map((p: AIProvider) => {
      if (p.id !== id) return p

      const updated = {
        ...p,
        [field]:
          field === 'contextWindow' ? parseInt(value, 10) || 8192 : value,
      }

      // Auto-update name if provider or model changes
      if (field === 'provider' || field === 'model') {
        // If provider changed, also update the model and URL to its default
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
    setAI({ ...ai, providers })
  }

  const handleSetActiveProvider = (id: string) => {
    setAI({ ...ai, activeId: id })
  }

  const handleAddProvider = () => {
    const id = `provider-${Date.now()}`
    const newProvider: AIProvider = {
      id,
      name: 'New Provider',
      provider: 'openai',
      baseUrl: '',
      apiKey: '',
      model: '',
    }
    const providers = [...(ai.providers || []), newProvider]
    setAI({ ...ai, providers, activeId: id })
  }

  const handleDeleteProvider = (id: string) => {
    const providers = (ai.providers || []).filter(
      (p: AIProvider) => p.id !== id,
    )
    let activeId = ai.activeId
    if (activeId === id) activeId = providers[0]?.id || ''
    setAI({ ...ai, providers, activeId })
  }

  return (
    <SettingsPage
      title="AI Providers"
      description="Manage multiple AI provider configurations and select the active one for your assistant."
      onRestore={actions.onRestore}
      primaryAction={
        <Button
          variant="ghost"
          size="sm"
          onClick={handleAddProvider}
          className={ADD_ITEM_BUTTON}
        >
          <Plus size={14} /> Add Provider
        </Button>
      }
    >
      <Section title="Configured Providers">
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
              <p className="text-sm">
                No AI providers configured. Add one to get started.
              </p>
            </div>
          )}
        </div>
      </Section>
    </SettingsPage>
  )
}
