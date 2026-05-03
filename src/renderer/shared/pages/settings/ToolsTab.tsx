import React from 'react';
import { SettingsState } from '../../lib/types';

interface ToolsTabProps {
  state: {
    aiTools: SettingsState['aiTools'];
    availableTools: any[];
  };
  actions: {
    setTools: (tools: SettingsState['aiTools']) => void;
  };
}

export function ToolsTab({
  state,
  actions
}: ToolsTabProps) {
  const { aiTools, availableTools } = state;
  const { setTools } = actions;

  const handleToggleTool = (id: string) => {
    const newTools = { ...aiTools, [id]: !aiTools[id] };
    setTools(newTools);
  };

  return (
    <div className="space-y-6 max-w-4xl pb-10">
      <div className="grid grid-cols-1 gap-3">
        {availableTools.map(tool => (
          <div key={tool.id} className="flex items-center justify-between p-3.5 rounded-lg border border-border/40 bg-accent/5 hover:bg-accent/10 transition-colors group">
            <div className="space-y-0.5 flex-1 min-w-0 pr-4">
              <h4 className="text-sm font-semibold truncate">{tool.name}</h4>
              <p className="text-[11px] text-muted-foreground opacity-70 group-hover:opacity-100 transition-opacity leading-relaxed">{tool.description}</p>
            </div>
            <button
              onClick={() => handleToggleTool(tool.id)}
              className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none ${aiTools?.[tool.id] ? 'bg-primary' : 'bg-muted'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${aiTools?.[tool.id] ? 'translate-x-5.5' : 'translate-x-1'}`} />
            </button>
          </div>
        ))}
        {availableTools.length === 0 && <div className="py-12 text-center text-sm text-muted-foreground italic border border-dashed border-border rounded-xl opacity-50">Loading tools...</div>}
      </div>
    </div>
  );
}
