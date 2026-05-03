import React, { useState } from 'react';
import { Plus, FileText } from 'lucide-react';
import { Button } from '../../basic/Button';
import { Modal } from '../../basic/Modal';
import { SettingsPage } from '../../featured/SettingsPage';
import { Section } from '../../basic/Section';
import { SettingsState, Agent } from '../../lib/types';
import { AgentCard } from '../../featured/AgentCard';
import { Collapsible } from '../../basic/Collapsible';
import { Trash2 } from 'lucide-react';

interface PromptFileRowProps {
  filePath: string;
  onDelete: () => void;
}

function PromptFileRow({ filePath, onDelete }: PromptFileRowProps) {
  return (
    <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-accent/5 group">
      <div className="flex flex-col min-w-0">
        <span className="text-xs font-medium truncate">{filePath.split(/[\/\\]/).pop()}</span>
        <span className="text-[10px] text-muted-foreground truncate">{filePath}</span>
      </div>
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={onDelete}
        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-all opacity-0 group-hover:opacity-100"
      >
        <Trash2 size={14} />
      </Button>
    </div>
  );
}

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
  
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);

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

  const confirmDeleteGlobalFile = () => {
    if (fileToDelete) {
      const newFiles = (prompts.files || []).filter(f => f !== fileToDelete);
      setAgentsTab({ prompts: { files: newFiles } });
      setFileToDelete(null);
    }
  };


  return (
    <SettingsPage
      title="Agents"
      description="Define specialized assistant personas with custom prompts. Agents can have their own sets of instruction files that extend the global behavior."
      onRestore={actions.onRestore}
    >
      {/* Global System Prompts */}
      <Section 
        title="Global System Prompts" 
        description="These prompt files are prepended to every assistant interaction."
        action={
          <Button 
            variant="ghost"
            size="sm"
            onClick={async () => {
              const res = await onPickPromptFile();
              if (res && res.data) {
                const newFiles = [...(prompts.files || []), res.data];
                setAgentsTab({ prompts: { files: Array.from(new Set(newFiles)) } });
              }
            }} 
            className="flex items-center gap-1.5 text-primary hover:bg-primary/10"
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
              onDelete={() => setFileToDelete(filePath)}
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
      <Section 
        title="Agent Profiles" 
        description="Switch between different personas for specific tasks."
        action={
          <Button 
            variant="ghost"
            size="sm"
            onClick={handleAddAgent} 
            className="flex items-center gap-1.5 text-primary hover:bg-primary/10"
          >
            <Plus size={14} /> Add Agent
          </Button>
        }
      >
        <div className="space-y-8">
          {(agents.list || []).map((agent: Agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              isActive={agents.activeId === agent.id}
              onSetActive={(id) => setAgentsTab({ agents: { ...agents, activeId: id } })}
              onUpdate={handleUpdateAgent}
              onDelete={handleDeleteAgent}
              onPickPromptFile={async (id) => {
                const res = await onPickPromptFile();
                if (res && res.data) {
                  const agentObj = (agents.list || []).find(a => a.id === id);
                  const newFiles = [...(agentObj?.promptFiles || []), res.data];
                  handleUpdateAgent(id, 'promptFiles', Array.from(new Set(newFiles)));
                }
              }}
            >
              <div className="pt-2">
                <Collapsible title="System Prompt Preview" icon={FileText} colorClass="border-primary/20" defaultExpanded={false}>
                  <div className="p-4 rounded-lg bg-background/50 border border-border/40 font-mono text-[10px] whitespace-pre-wrap max-h-60 overflow-y-auto">
                    {agents.activeId === agent.id ? mergedPrompt : <span className="text-muted-foreground italic">Switch to this agent to see the preview.</span>}
                  </div>
                </Collapsible>
              </div>
            </AgentCard>
          ))}
        </div>
      </Section>

      {/* Global File Delete Confirmation */}
      <Modal
        isOpen={!!fileToDelete}
        onClose={() => setFileToDelete(null)}
        title="Remove Global Prompt"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setFileToDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDeleteGlobalFile}>Remove File</Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Are you sure you want to remove <span className="font-bold text-foreground">"{fileToDelete?.split(/[\/\\]/).pop()}"</span> from the global prompt list?
        </p>
      </Modal>
    </SettingsPage>
  );
}
