import React from 'react';
import { Plus, RotateCcw, FileText } from 'lucide-react';
import { SettingsState, Agent } from '../../lib/types';
import { AgentCard } from '../../featured/AgentCard';
import { PromptFileRow } from '../../featured/PromptFileRow';
import { Collapsible } from '../../basic/Collapsible';

interface AgentsTabProps {
  state: {
    agents: SettingsState['agents'];
    prompts: SettingsState['prompts'];
    mergedPrompt: string;
  };
  actions: {
    setAgentsTab: (payload: { agents?: SettingsState['agents'], prompts?: SettingsState['prompts'] }) => void;
    onPickPromptFile: () => Promise<any>;
  };
}

export function AgentsTab({
  state,
  actions
}: AgentsTabProps) {
  const { agents, prompts, mergedPrompt } = state;
  const { setAgentsTab, onPickPromptFile } = actions;

  const handleUpdateAgent = (id: string, field: string, value: any) => {
    const list = (agents.list || []).map((a: Agent) => 
      a.id === id ? { ...a, [field]: value } : a
    );
    setAgentsTab({ agents: { ...agents, list } });
  };

  const handleDeleteAgent = (id: string) => {
    const list = (agents.list || []).filter((a: Agent) => a.id !== id);
    let activeId = agents.activeId;
    if (activeId === id) activeId = list[0]?.id || '';
    setAgentsTab({ agents: { ...agents, list, activeId } });
  };

  const handleAddAgent = () => {
    const id = `agent-${Date.now()}`;
    const newAgent: Agent = { id, name: 'New Agent', promptFiles: [] };
    const list = [...(agents.list || []), newAgent];
    setAgentsTab({ agents: { ...agents, list, activeId: id } });
  };


  return (
    <div className="space-y-10 max-w-4xl pb-10">
      <div className="flex items-center justify-between border-b border-border/30 pb-4">
        <p className="text-sm text-muted-foreground">Manage global prompts and specialized agents.</p>
      </div>

      {/* Global System Prompts */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">Global System Prompts</h3>
          <div className="flex items-center gap-2">
            <button 
              onClick={async () => {
                const res = await onPickPromptFile();
                if (res && res.data) {
                  const newFiles = [...(prompts.files || []), res.data];
                  setAgentsTab({ prompts: { files: Array.from(new Set(newFiles)) } });
                }
              }} 
              className="flex items-center gap-1.5 bg-primary hover:opacity-90 text-primary-foreground px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
            >
              <Plus size={14} /> Add File
            </button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-4">These prompts are applied to all agents.</p>
        <div className="space-y-2">
          {(prompts.files || []).map((filePath) => (
            <PromptFileRow
              key={filePath}
              filePath={filePath}
              onDelete={() => {
                const newFiles = (prompts.files || []).filter(f => f !== filePath);
                setAgentsTab({ prompts: { files: newFiles } });
              }}
            />
          ))}
        </div>
      </div>

      {/* Agents List */}
      <div className="pt-6 border-t border-border">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium">Agents</h3>
          <button 
            onClick={handleAddAgent} 
            className="flex items-center gap-1.5 bg-primary hover:opacity-90 text-primary-foreground px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
          >
            <Plus size={14} /> Add Agent
          </button>
        </div>

        <div className="space-y-6">
          {(agents.list || []).map((agent: Agent) => (
            <div key={agent.id} className="space-y-2">
              <AgentCard
                agent={agent}
                isActive={agents.activeId === agent.id}
                onSetActive={(id) => setAgentsTab({ agents: { ...agents, activeId: id } })}
                onUpdate={handleUpdateAgent}
                onDelete={handleDeleteAgent}
                onPickPromptFile={async (id) => {
                  const res = await onPickPromptFile();
                  if (res && res.data) {
                    const agent = (agents.list || []).find(a => a.id === id);
                    const newFiles = [...(agent?.promptFiles || []), res.data];
                    handleUpdateAgent(id, 'promptFiles', Array.from(new Set(newFiles)));
                  }
                }}
              />
              <div className="ml-7 pt-2">
                <Collapsible title="System Prompt Preview" icon={FileText} colorClass="border-primary/20" defaultExpanded={false}>
                  <div className="p-4 rounded-lg bg-background/50 border border-border/40 font-mono text-[10px] whitespace-pre-wrap max-h-60 overflow-y-auto">
                    {agents.activeId === agent.id ? mergedPrompt : <span className="text-muted-foreground italic">Switch to this agent to see the preview.</span>}
                  </div>
                </Collapsible>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
