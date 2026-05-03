import React from 'react';
import { Bot, Plus, RotateCcw } from 'lucide-react';
import { SettingsState, AIProviderInstance } from '../../lib/types';
import { Button } from '../../basic/Button';
import { SettingsPage } from '../../featured/SettingsPage';
import { Section } from '../../basic/Section';
import { AIProviderCard } from '../../featured/advanced/AIProviderCard';
import { DEFAULT_PROVIDER_MODELS, DEFAULT_PROVIDER_URLS } from '../../lib/constants';

interface AITabProps {
  state: {
    ai: SettingsState['ai'];
  };
  actions: {
    setAI: (ai: SettingsState['ai']) => void;
    onRestore?: () => void;
  };
}

export function AITab({
  state,
  actions
}: AITabProps) {
  const { ai } = state;
  const { setAI } = actions;

  const handleUpdateProvider = (id: string, field: string, value: any) => {
    const providers = (ai.providers || []).map((p: AIProviderInstance) => {
      if (p.id !== id) return p;

      const updated = {
        ...p,
        [field]: field === 'contextWindow' ? (parseInt(value, 10) || 8192) : value
      };

      // Auto-update name if provider or model changes
      if (field === 'provider' || field === 'model') {
        // If provider changed, also update the model and URL to its default
        if (field === 'provider') {
          updated.model = DEFAULT_PROVIDER_MODELS[value] || updated.model;
          updated.url = DEFAULT_PROVIDER_URLS[value] !== undefined ? DEFAULT_PROVIDER_URLS[value] : updated.url;
        }

        const providerLabel: Record<string, string> = {
          ollama: 'Ollama',
          openai: 'OpenAI',
          anthropic: 'Anthropic',
          gemini: 'Gemini',
          deepseek: 'DeepSeek',
          others: 'Compatible'
        };

        const label = providerLabel[updated.provider] || updated.provider;
        updated.name = `${label} - ${updated.model || 'Default'}`;
      }

      return updated;
    });
    setAI({ ...ai, providers });
  };

  const handleSetActiveProvider = (id: string) => {
    setAI({ ...ai, activeId: id });
  };

  const handleAddProvider = () => {
    const id = `provider-${Date.now()}`;
    const newProvider: AIProviderInstance = { 
      id, 
      name: 'New Provider', 
      provider: 'openai', 
      url: '', 
      apiKey: '', 
      model: '' 
    };
    const providers = [...(ai.providers || []), newProvider];
    setAI({ ...ai, providers, activeId: id });
  };

  const handleDeleteProvider = (id: string) => {
    const providers = (ai.providers || []).filter((p: AIProviderInstance) => p.id !== id);
    let activeId = ai.activeId;
    if (activeId === id) activeId = providers[0]?.id || '';
    setAI({ ...ai, providers, activeId });
  };

  return (
    <SettingsPage
      title="AI Providers"
      description="Manage multiple AI provider configurations and select the active one for your assistant."
      primaryAction={
        <div className="flex gap-2">
          {actions.onRestore && (
            <Button variant="ghost" size="sm" onClick={actions.onRestore} className="flex items-center gap-1.5 text-muted-foreground">
              <RotateCcw size={14} /> Restore
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAddProvider}
            className="flex items-center gap-1.5 text-primary hover:bg-primary/10"
          >
            <Plus size={14} /> Add Provider
          </Button>
        </div>
      }
    >
      <Section title="Configured Providers">
        <div className="space-y-6">
          {(ai.providers || []).map((provider: AIProviderInstance) => (
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
              <p className="text-sm">No AI providers configured. Add one to get started.</p>
            </div>
          )}
        </div>
      </Section>
    </SettingsPage>
  );
}
