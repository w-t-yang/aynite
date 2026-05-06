import { useState } from 'react'
import type { AIProviderInstance } from '../lib/types'
import { Input } from '../basic/Input'
import { DESCRIPTION_TEXT } from '../lib/styles'
import { EditableCardFrame, EditableCardHeader, DeleteItemModal } from './EditableCard'
import { SelectionMenu } from './SelectionMenu'

interface AIProviderCardProps {
  provider: AIProviderInstance
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

          {provider.provider !== 'ollama' && (
            <div className="col-span-2">
              <Input
                label="API Key"
                type="password"
                value={provider.apiKey || ''}
                onChange={(e) =>
                  onUpdate(provider.id, 'apiKey', e.target.value)
                }
                placeholder="sk-..."
              />
            </div>
          )}

          <div className="col-span-2">
            <Input
              label="Base URL"
              value={provider.url || ''}
              onChange={(e) => onUpdate(provider.id, 'url', e.target.value)}
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
