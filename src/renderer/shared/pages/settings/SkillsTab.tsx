import React, { useState } from 'react';
import { Plus, Trash2, AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '../../basic/Button';
import { SettingsPage } from '../../featured/SettingsPage';
import { Section } from '../../basic/Section';
import { Modal } from '../../featured/Modal';
import { SettingsState } from '../../lib/types';
import { cn } from '../../lib/utils';

interface SkillsTabProps {
  state: {
    skills: SettingsState['skills'];
    availableSkills: any[];
  };
  actions: {
    setSkills: (skills: SettingsState['skills']) => void;
    onPickSkillFolder: () => Promise<any>;
    onRestore?: () => void;
  };
}

export function SkillsTab({
  state,
  actions
}: SkillsTabProps) {
  const { skills, availableSkills } = state;
  const { setSkills, onPickSkillFolder } = actions;
  
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null);

  const handleAddFolder = async () => {
    const res = await onPickSkillFolder();
    if (res && res.data) {
      const folders = skills?.folders || [];
      const newFolders = [...folders, res.data];
      setSkills({ folders: Array.from(new Set(newFolders)) });
    }
  };

  const confirmRemoveFolder = () => {
    if (folderToDelete) {
      const folders = skills?.folders || [];
      const newFolders = folders.filter(f => f !== folderToDelete);
      setSkills({ folders: newFolders });
      setFolderToDelete(null);
    }
  };

  return (
    <SettingsPage
      title="Skills"
      description="Extend the assistant's capabilities with custom scripts. You can add folders containing skill definitions that the assistant can execute."
      onRestore={actions.onRestore}
    >
      <Section 
        title="Skill Source Folders" 
        description="Directories where Aynite looks for skill implementations."
        action={
          <Button 
            variant="ghost"
            size="sm"
            onClick={handleAddFolder} 
            className="flex items-center gap-1.5 text-primary hover:bg-primary/10"
          >
            <Plus size={14} /> Add Folder
          </Button>
        }
      >
        <div className="space-y-2">
          {(skills?.folders || []).map((folder) => (
            <div key={folder} className="flex items-center justify-between p-3 rounded-lg border border-border bg-accent/10 group">
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium truncate">{folder.split(/[\/\\]/).pop()}</span>
                <span className="text-[10px] text-muted-foreground truncate">{folder}</span>
              </div>
              <Button 
                variant="ghost"
                size="icon"
                onClick={() => setFolderToDelete(folder)} 
                className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-all opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={16} />
              </Button>
            </div>
          ))}
          {(!skills?.folders || skills.folders.length === 0) && (
            <div className="py-8 text-center text-xs text-muted-foreground italic border border-dashed border-border rounded-lg">
              No skill folders added.
            </div>
          )}
        </div>
      </Section>

      <Section title="Detected Skills" description="A list of all skills found and parsed from your folders.">
        <div className="grid grid-cols-2 gap-4">
          {availableSkills.map(skill => (
            <div key={skill.path} className={cn("p-4 rounded-xl border bg-accent/5 transition-all", skill.error ? "border-destructive/30" : "border-border hover:border-border/60")}>
              <div className="flex items-center gap-2 mb-2">
                {skill.error && <AlertCircle size={14} className="text-destructive" />}
                <span className={cn("text-xs font-bold uppercase tracking-wider", skill.error && "text-destructive")}>{skill.name}</span>
              </div>
              <p className="text-[11px] text-muted-foreground line-clamp-2 mb-3 leading-relaxed">{skill.description || 'No description available.'}</p>
              {skill.error && (
                <div className="p-2 rounded bg-destructive/10 text-[9px] text-destructive font-mono leading-tight whitespace-pre-wrap border border-destructive/20">
                  {skill.error}
                </div>
              )}
              {!skill.error && <div className="text-[9px] text-muted-foreground/40 truncate font-mono">{skill.path}</div>}
            </div>
          ))}
          {availableSkills.length === 0 && (
            <div className="col-span-full py-8 text-center text-xs text-muted-foreground italic border border-dashed border-border rounded-lg opacity-50">
              No skills detected.
            </div>
          )}
        </div>
      </Section>

      <Modal
        isOpen={!!folderToDelete}
        onClose={() => setFolderToDelete(null)}
        title="Remove Skill Folder"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setFolderToDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmRemoveFolder}>Remove Folder</Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Are you sure you want to remove the folder <span className="font-bold text-foreground">"{folderToDelete?.split(/[\/\\]/).pop()}"</span>? The assistant will no longer be able to use skills from this directory.
        </p>
      </Modal>
    </SettingsPage>
  );
}
