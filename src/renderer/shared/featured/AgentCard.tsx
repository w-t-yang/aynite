import React from 'react';
import { Trash2, Plus } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from '../basic/Button';
import { Input } from '../basic/Input';
import { Radio } from '../basic/Radio';
import { PromptFileRow } from './PromptFileRow';

interface AgentCardProps {
  agent: any;
  isActive: boolean;
  onSetActive: (id: string) => void;
  onUpdate: (id: string, field: string, value: any) => void;
  onDelete: (id: string) => void;
  onPickPromptFile: (id: string) => void;
}

export function AgentCard({
  agent,
  isActive,
  onSetActive,
  onUpdate,
  onDelete,
  onPickPromptFile
}: AgentCardProps) {
  return (
    <div className={cn(
      "p-5 rounded-xl border transition-all space-y-4",
      isActive ? "border-primary bg-accent/5" : "border-border bg-accent/5"
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Radio
            name="active-agent"
            checked={isActive}
            onChange={() => onSetActive(agent.id)}
          />
          <Input
            unstyled
            className="font-bold w-64"
            value={agent.name}
            onChange={(e) => onUpdate(agent.id, 'name', e.target.value)}
            placeholder="Agent Name"
          />
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => onDelete(agent.id)}
          className="hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 size={16} />
        </Button>
      </div>

      <div className="ml-7 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Agent Prompt Files</h4>
          <Button variant="outline" size="sm" onClick={() => onPickPromptFile(agent.id)} className="h-7 py-0 px-2 text-[10px]">
            <Plus size={12} /> Add File
          </Button>
        </div>
        <div className="space-y-2">
          {(agent.promptFiles || []).map((filePath: string) => (
            <PromptFileRow 
              key={filePath} 
              filePath={filePath} 
              onDelete={() => {
                const newFiles = agent.promptFiles.filter((f: string) => f !== filePath);
                onUpdate(agent.id, 'promptFiles', newFiles);
              }} 
            />
          ))}
          {(!agent.promptFiles || agent.promptFiles.length === 0) && (
            <p className="text-[10px] text-muted-foreground/40 italic">No agent-specific prompts.</p>
          )}
        </div>
      </div>
    </div>
  );
}
