import { useMemo, useState } from 'react'
import { DESCRIPTION_TEXT } from '../../../lib/constants/renderer/styles'
import type { DynamicApiKeyConfig } from '../../../lib/types/ai'
import { Input } from '../basic/Input'
import type { AIProvider } from '../lib/types'
import {
  DeleteItemModal,
  EditableCardFrame,
  EditableCardHeader,
} from './EditableCard'
import { SelectionMenu } from './SelectionMenu'

/** Determine if the API key config is dynamic (vs static string) */
function isDynamicKey(key: unknown): key is DynamicApiKeyConfig {
  return (
    typeof key === 'object' && key !== null && (key as any).type === 'dynamic'
  )
}

interface AIProviderCardProps {
  provider: AIProvider
  isActive: boolean
  onSetActive: (id: string) => void
  onUpdate: (id: string, field: string, value: any) => void
  onDelete: (id: string) => void
}

export function AIProviderCard({
  provider,
  isActive,
  onSetActive,
  onUpdate,
  onDelete,
}: AIProviderCardProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  // Derive current API key mode from the provider config
  const keyMode = useMemo(() => {
    if (isDynamicKey(provider.apiKey)) return 'dynamic' as const
    return 'static' as const
  }, [provider.apiKey])

  const dynamicConfig = isDynamicKey(provider.apiKey)
    ? (provider.apiKey as DynamicApiKeyConfig)
    : null

  const handleKeyModeChange = (mode: string) => {
    if (mode === 'dynamic') {
      onUpdate(provider.id, 'apiKey', {
        type: 'dynamic',
        script: '',
        ttl: 60,
      } satisfies DynamicApiKeyConfig)
    } else {
      onUpdate(provider.id, 'apiKey', '')
    }
  }

  const handleDynamicUpdate = (field: string, value: any) => {
    const current = dynamicConfig || { type: 'dynamic', script: '', ttl: 60 }
    onUpdate(provider.id, 'apiKey', {
      ...current,
      [field]: field === 'ttl' ? Number(value) : value,
    })
  }

  return (
    <>
      <EditableCardFrame isActive={isActive}>
        <EditableCardHeader
          radioName="active-ai-provider"
          isActive={isActive}
          onSetActive={() => onSetActive(provider.id)}
          itemName={provider.name}
          onNameChange={(v) => onUpdate(provider.id, 'name', v)}
          placeholder="Config Name"
          onDeleteRequest={() => setShowDeleteModal(true)}
        />

        <div className="grid grid-cols-2 gap-4 ml-7">
          <SelectionMenu
            label="Model Provider"
            activeId={provider.provider}
            onSelect={(v) => onUpdate(provider.id, 'provider', v)}
            items={[
              { id: 'ollama', label: 'Ollama' },
              { id: 'openai', label: 'OpenAI' },
              { id: 'anthropic', label: 'Anthropic' },
              { id: 'gemini', label: 'Gemini/Google' },
              { id: 'deepseek', label: 'DeepSeek' },
              { id: 'others', label: 'Other (Compatible)' },
            ]}
          />

          <Input
            label="Model"
            value={provider.model}
            onChange={(e) => onUpdate(provider.id, 'model', e.target.value)}
            placeholder="e.g. gpt-4o or deepseek-r1"
          />

          <SelectionMenu
            label="Reasoning Effort"
            activeId={provider.reasoningEffort || 'off'}
            onSelect={(v) => onUpdate(provider.id, 'reasoningEffort', v)}
            items={[
              { id: 'off', label: 'Off (Fastest)' },
              { id: 'low', label: 'Low' },
              { id: 'medium', label: 'Medium' },
              { id: 'high', label: 'High (Deep Thinking)' },
            ]}
          />

          {provider.provider !== 'ollama' && (
            <div className="col-span-2 space-y-3">
              <SelectionMenu
                label="API Key Type"
                activeId={keyMode}
                onSelect={handleKeyModeChange}
                items={[
                  { id: 'static', label: 'Static (Enter Key)' },
                  { id: 'dynamic', label: 'Dynamic (Run Script)' },
                ]}
              />

              {keyMode === 'static' ? (
                <Input
                  label="API Key"
                  type="password"
                  value={
                    typeof provider.apiKey === 'string' ? provider.apiKey : ''
                  }
                  onChange={(e) =>
                    onUpdate(provider.id, 'apiKey', e.target.value)
                  }
                  placeholder="sk-..."
                />
              ) : (
                <div className="space-y-3">
                  <Input
                    label="Script (one-liner)"
                    value={dynamicConfig?.script || ''}
                    onChange={(e) =>
                      handleDynamicUpdate('script', e.target.value)
                    }
                    placeholder='echo "$MY_API_KEY"'
                  />
                  <Input
                    label="TTL (seconds)"
                    type="number"
                    value={dynamicConfig?.ttl ?? 60}
                    onChange={(e) => handleDynamicUpdate('ttl', e.target.value)}
                    placeholder="60"
                  />
                  <p className="text-[11px] text-muted-foreground/50 leading-relaxed">
                    The script is executed before each API request. The result
                    is cached for the TTL duration (refreshed before expiry).
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="col-span-2">
            <Input
              label="Base URL"
              value={provider.baseUrl || ''}
              onChange={(e) => onUpdate(provider.id, 'baseUrl', e.target.value)}
              placeholder={
                provider.provider === 'ollama'
                  ? 'http://localhost:11434'
                  : 'API URL'
              }
            />
          </div>

          {provider.provider === 'others' && (
            <SelectionMenu
              label="Compatibility"
              activeId={provider.compatibility || 'openai'}
              onSelect={(v) => onUpdate(provider.id, 'compatibility', v)}
              items={[
                { id: 'openai', label: 'OpenAI' },
                { id: 'anthropic', label: 'Anthropic' },
                { id: 'google', label: 'Google' },
              ]}
            />
          )}

          {provider.provider === 'ollama' && (
            <Input
              label="Context Window"
              type="number"
              value={provider.contextWindow || 8192}
              onChange={(e) =>
                onUpdate(provider.id, 'contextWindow', e.target.value)
              }
            />
          )}
        </div>
      </EditableCardFrame>

      <DeleteItemModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onDelete={() => onDelete(provider.id)}
        title="Delete AI Provider"
        itemName={provider.name}
        deleteLabel="Delete Provider"
      >
        <p className={DESCRIPTION_TEXT}>
          This action will permanently remove this provider configuration.
        </p>
      </DeleteItemModal>
    </>
  )
}
