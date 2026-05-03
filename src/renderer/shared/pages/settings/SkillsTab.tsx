import React from 'react';
import { Plus, Trash2, AlertCircle } from 'lucide-react';
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
  };
}

export function SkillsTab({
  state,
  actions
}: SkillsTabProps) {
  const { skills, availableSkills } = state;
  const { setSkills, onPickSkillFolder } = actions;

  const handleAddFolder = async () => {
    const res = await onPickSkillFolder();
    if (res && res.data) {
      const folders = skills?.folders || [];
      const newFolders = [...folders, res.data];
      setSkills({ folders: Array.from(new Set(newFolders)) });
    }
  };

  const handleRemoveFolder = (folder: string) => {
    const folders = skills?.folders || [];
    const newFolders = folders.filter(f => f !== folder);
    setSkills({ folders: newFolders });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">Skill Folders</h3>
          <button 
            onClick={handleAddFolder} 
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:opacity-90 text-primary-foreground rounded-md text-xs font-medium transition-colors"
          >
            <Plus size={14} /> Add Folder
          </button>
        </div>
        <div className="space-y-2">
          {(skills?.folders || []).map((folder) => (
            <div key={folder} className="flex items-center justify-between p-3 rounded-lg border border-border bg-accent/10 group">
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium truncate">{folder.split(/[\/\\]/).pop()}</span>
                <span className="text-[10px] text-muted-foreground truncate">{folder}</span>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleRemoveFolder(folder)} 
                  className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-medium mb-4">Detected Skills</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {availableSkills.map(skill => (
            <div key={skill.path} className={cn("p-3 rounded-lg border bg-accent/5", skill.error ? "border-destructive/30" : "border-border")}>
              <div className="flex items-center gap-2 mb-1">
                {skill.error && <AlertCircle size={14} className="text-destructive" />}
                <span className={cn("text-xs font-semibold", skill.error && "text-destructive")}>{skill.name}</span>
              </div>
              <p className="text-[10px] text-muted-foreground line-clamp-2 mb-2">{skill.description || 'No description'}</p>
              {skill.error && (
                <div className="p-2 rounded bg-destructive/10 text-[9px] text-destructive font-mono leading-tight whitespace-pre-wrap">
                  {skill.error}
                </div>
              )}
              {!skill.error && <div className="text-[9px] text-muted-foreground/50 truncate font-mono">{skill.path}</div>}
            </div>
          ))}
          {availableSkills.length === 0 && <div className="col-span-full py-8 text-center text-xs text-muted-foreground italic border border-dashed border-border rounded-lg">No skills detected in the configured folders.</div>}
        </div>
      </div>
    </div>
  );
}
