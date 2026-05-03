import React from 'react';
import { Bot, Plus } from 'lucide-react';
import { SettingsState, AIProviderInstance } from '../../lib/types';
import { AIProviderCard } from '../../featured/AIProviderCard';

interface AITabProps {
  state: {
    ai: SettingsState['ai'];
  };
  actions: {
    setAI: (ai: SettingsState['ai']) => void;
  };
}

export function AITab({
  state,
  actions
}: AITabProps) {
  const { ai } = state;
  const { setAI } = actions;

  const handleUpdateProvider = (id: string, field: string, value: any) => {
    const providers = (ai.providers || []).map((p: AIProviderInstance) => 
      p.id === id ? { ...p, [field]: value } : p
    );
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
    <div className="space-y-6 max-w-4xl">
      <div>
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-muted-foreground">Manage multiple AI provider configurations and select the active one.</p>
          <button
            onClick={handleAddProvider}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:opacity-90 text-primary-foreground rounded-md text-xs font-medium transition-colors"
          >
            <Plus size={14} /> Add Provider
          </button>
        </div>

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
      </div>
    </div>
  );
}
