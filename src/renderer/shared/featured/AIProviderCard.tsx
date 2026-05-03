import React from 'react';
import { Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { Input } from '../basic/Input';
import { Select } from '../basic/Select';
import { Button } from '../basic/Button';
import { Radio } from '../basic/Radio';
import { AIProviderInstance } from '../lib/types';

interface AIProviderCardProps {
  provider: AIProviderInstance;
  isActive: boolean;
  onSetActive: (id: string) => void;
  onUpdate: (id: string, field: string, value: any) => void;
  onDelete: (id: string) => void;
}

export function AIProviderCard({
  provider,
  isActive,
  onSetActive,
  onUpdate,
  onDelete
}: AIProviderCardProps) {
  return (
    <div className={cn(
      "p-5 rounded-xl border transition-all space-y-4",
      isActive ? "border-primary bg-accent/5" : "border-border bg-accent/5"
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Radio
            name="active-ai-provider"
            checked={isActive}
            onChange={() => onSetActive(provider.id)}
          />
          <Input
            unstyled
            className="font-bold w-64"
            value={provider.name}
            onChange={(e) => onUpdate(provider.id, 'name', e.target.value)}
            placeholder="Config Name"
          />
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => onDelete(provider.id)}
          className="hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 size={16} />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 ml-7">
        <Select
          label="Type"
          value={provider.provider}
          onChange={(e) => onUpdate(provider.id, 'provider', e.target.value)}
          options={[
            { value: 'ollama', label: 'Ollama' },
            { value: 'openai', label: 'OpenAI' },
            { value: 'anthropic', label: 'Anthropic' },
            { value: 'gemini', label: 'Gemini/Google' },
            { value: 'deepseek', label: 'DeepSeek' },
            { value: 'others', label: 'Other (Compatible)' }
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
              onChange={(e) => onUpdate(provider.id, 'apiKey', e.target.value)}
              placeholder="sk-..."
            />
          </div>
        )}

        <div className="col-span-2">
          <Input
            label="Base URL"
            value={provider.url || ''}
            onChange={(e) => onUpdate(provider.id, 'url', e.target.value)}
            placeholder={provider.provider === 'ollama' ? "http://localhost:11434" : "API URL"}
          />
        </div>

        {provider.provider === 'others' && (
          <Select
            label="Compatibility"
            value={provider.compatibility || 'openai'}
            onChange={(e) => onUpdate(provider.id, 'compatibility', e.target.value)}
            options={[
              { value: 'openai', label: 'OpenAI' },
              { value: 'anthropic', label: 'Anthropic' },
              { value: 'google', label: 'Google' }
            ]}
          />
        )}

        {provider.provider === 'ollama' && (
          <Input
            label="Context Window"
            type="number"
            value={provider.contextWindow || 8192}
            onChange={(e) => onUpdate(provider.id, 'contextWindow', e.target.value)}
          />
        )}
      </div>
    </div>
  );
}
