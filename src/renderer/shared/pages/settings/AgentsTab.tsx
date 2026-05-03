import React from 'react';
import { Plus, RotateCcw, FileText } from 'lucide-react';
import { Button } from '../../basic/Button';
import { SettingsPage } from '../../basic/SettingsPage';
import { Section } from '../../basic/Section';
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
    onRestore?: () => void;
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
    <SettingsPage
      title="Agents"
      description="Define specialized assistant personas with custom prompts. Agents can have their own sets of instruction files that extend the global behavior."
      primaryAction={
        <div className="flex gap-2">
          {actions.onRestore && (
            <Button variant="ghost" size="sm" onClick={actions.onRestore} className="flex items-center gap-1.5 text-muted-foreground">
              <RotateCcw size={14} /> Restore
            </Button>
          )}
          <Button 
            variant="primary"
            size="sm"
            onClick={handleAddAgent} 
            className="flex items-center gap-1.5"
          >
            <Plus size={14} /> Add Agent
          </Button>
        </div>
      }
    >
      {/* Global System Prompts */}
      <Section 
        title="Global System Prompts" 
        description="These prompt files are prepended to every assistant interaction, regardless of the active agent."
        action={
          <Button 
            variant="outline"
            size="sm"
            onClick={async () => {
              const res = await onPickPromptFile();
              if (res && res.data) {
                const newFiles = [...(prompts.files || []), res.data];
                setAgentsTab({ prompts: { files: Array.from(new Set(newFiles)) } });
              }
            }} 
            className="flex items-center gap-1.5"
          >
            <Plus size={14} /> Add File
          </Button>
        }
      >
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
          {(!prompts.files || prompts.files.length === 0) && (
            <p className="text-xs text-muted-foreground/50 italic py-4 text-center border border-dashed border-border rounded-lg">
              No global prompt files configured.
            </p>
          )}
        </div>
      </Section>

      {/* Agents List */}
      <Section title="Agent Profiles" description="Switch between different personas for specific tasks.">
        <div className="space-y-8">
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
      </Section>
    </SettingsPage>
  );
}
