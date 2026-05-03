import React from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '../../basic/Button';
import { Switch } from '../../basic/Switch';
import { SettingsPage } from '../../basic/SettingsPage';
import { Section } from '../../basic/Section';
import { SettingsState } from '../../lib/types';

interface ToolsTabProps {
  state: {
    aiTools: SettingsState['aiTools'];
    availableTools: any[];
  };
  actions: {
    setTools: (tools: SettingsState['aiTools']) => void;
    onRestore?: () => void;
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
    <SettingsPage
      title="Tools"
      description="Enable or disable built-in tools for the AI to interact with your system. These tools allow the assistant to perform actions like file management, web search, and terminal execution."
      primaryAction={
        actions.onRestore && (
          <Button variant="ghost" size="sm" onClick={actions.onRestore} className="flex items-center gap-1.5 text-muted-foreground">
            <RotateCcw size={14} /> Restore
          </Button>
        )
      }
    >
      <Section title="System Capabilities" description="Toggle individual tools to control what the assistant can do.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {availableTools.map(tool => (
            <div key={tool.id} className="flex items-center justify-between p-4 rounded-xl border border-border/40 bg-accent/5 hover:bg-accent/10 transition-all group">
              <div className="space-y-1 flex-1 min-w-0 pr-6">
                <h4 className="text-sm font-bold uppercase tracking-wider">{tool.name}</h4>
                <p className="text-[11px] text-muted-foreground opacity-70 group-hover:opacity-100 transition-opacity leading-relaxed line-clamp-2">{tool.description}</p>
              </div>
              <Switch
                checked={!!aiTools?.[tool.id]}
                onCheckedChange={() => handleToggleTool(tool.id)}
              />
            </div>
          ))}
          {availableTools.length === 0 && (
            <div className="col-span-full py-12 text-center text-sm text-muted-foreground italic border border-dashed border-border rounded-xl opacity-50">
              No tools available.
            </div>
          )}
        </div>
      </Section>
    </SettingsPage>
  );
}
