import React from 'react';
import { SettingsState } from '../../lib/types';
import { KeybindingRow } from '../../featured/KeybindingRow';
import { SettingsPage } from '../../basic/SettingsPage';
import { Section } from '../../basic/Section';
import { Button } from '../../basic/Button';
import { RotateCcw } from 'lucide-react';

interface KeybindingsTabProps {
  state: {
    keybindings: SettingsState['keybindings'];
  };
  actions: {
    setKeybindings: (keybindings: SettingsState['keybindings']) => void;
    onRestore?: () => void;
  };
}

export function KeybindingsTab({
  state,
  actions
}: KeybindingsTabProps) {
  const { keybindings } = state;
  const { setKeybindings } = actions;

  const handleKeybindingChange = (group: string, type: string, value: string) => {
    const newKeybindings = { ...keybindings } as any;
    newKeybindings[group] = { ...newKeybindings[group], [type]: value };
    setKeybindings(newKeybindings);
  };

  const handleKeybindingChangeNested = (group: string, subGroup: string, type: string, value: string) => {
    const newKeybindings = { ...keybindings } as any;
    newKeybindings[group] = { 
      ...newKeybindings[group], 
      [subGroup]: { ...newKeybindings[group][subGroup], [type]: value } 
    };
    setKeybindings(newKeybindings);
  };

  return (
    <SettingsPage
      title="Keybindings"
      description="Configure keyboard shortcuts for navigation, editing, and assistant actions. Press any combination of keys to assign a shortcut."
      primaryAction={
        actions.onRestore && (
          <Button variant="ghost" size="sm" onClick={actions.onRestore} className="flex items-center gap-1.5 text-muted-foreground">
            <RotateCcw size={14} /> Restore Defaults
          </Button>
        )
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="space-y-12">
          <Section title="Global" description="App-wide shortcuts.">
            <div className="space-y-1">
              <KeybindingRow label="Refresh App" value={keybindings.global.refresh} onChange={(v) => handleKeybindingChange('global', 'refresh', v)} />
              <KeybindingRow label="Quit App" value={keybindings.global.quit} onChange={(v) => handleKeybindingChange('global', 'quit', v)} />
            </div>
          </Section>

          <Section title="Explorer" description="Navigation in the file tree.">
            <div className="space-y-1">
              <KeybindingRow label="Toggle Left Panel" value={keybindings.explorer.toggleLeftPanel} onChange={(v) => handleKeybindingChange('explorer', 'toggleLeftPanel', v)} />
            </div>
          </Section>

          <Section title="Aynite Assistant" description="Interactions with the AI chat.">
            <div className="space-y-1">
              <KeybindingRow label="Focus Chat Input" value={keybindings.agent.focusChat} onChange={(v) => handleKeybindingChange('agent', 'focusChat', v)} />
              <KeybindingRow label="Focus & Skills" value={keybindings.agent.focusSkills} onChange={(v) => handleKeybindingChange('agent', 'focusSkills', v)} />
              <KeybindingRow label="Focus & Commands" value={keybindings.agent.focusCommands} onChange={(v) => handleKeybindingChange('agent', 'focusCommands', v)} />
              <KeybindingRow label="Chat Submit" value={keybindings.agent.submit} onChange={(v) => handleKeybindingChange('agent', 'submit', v)} />
              <KeybindingRow label="Toggle Right Panel" value={keybindings.agent.toggleRightPanel} onChange={(v) => handleKeybindingChange('agent', 'toggleRightPanel', v)} />
            </div>
          </Section>
        </div>

        <div className="space-y-12">
          <Section title="Content Navigation" description="Moving between tabs and views.">
            <div className="space-y-1">
              <KeybindingRow label="Switch Tab" value={keybindings.content.navigation.switchTab} onChange={(v) => handleKeybindingChangeNested('content', 'navigation', 'switchTab', v)} />
              <KeybindingRow label="Close Active Tab" value={keybindings.content.navigation.closeTab} onChange={(v) => handleKeybindingChangeNested('content', 'navigation', 'closeTab', v)} />
              <KeybindingRow label="Focus Active Tab" value={keybindings.content.navigation.focusContent} onChange={(v) => handleKeybindingChangeNested('content', 'navigation', 'focusContent', v)} />
            </div>
          </Section>

          <Section title="Content Viewer" description="Read-only mode navigation (Vim style).">
            <div className="space-y-1">
              <KeybindingRow label="Enter Edit Mode" value={keybindings.content.viewer.enterEdit} onChange={(v) => handleKeybindingChangeNested('content', 'viewer', 'enterEdit', v)} />
              <KeybindingRow label="Vim Move Down" value={keybindings.content.viewer.moveDown} onChange={(v) => handleKeybindingChangeNested('content', 'viewer', 'moveDown', v)} />
              <KeybindingRow label="Vim Move Up" value={keybindings.content.viewer.moveUp} onChange={(v) => handleKeybindingChangeNested('content', 'viewer', 'moveUp', v)} />
              <KeybindingRow label="Search Buffer" value={keybindings.content.viewer.search} onChange={(v) => handleKeybindingChangeNested('content', 'viewer', 'search', v)} />
              <KeybindingRow label="Refresh Tab / Revert" value={keybindings.content.viewer.refresh} onChange={(v) => handleKeybindingChangeNested('content', 'viewer', 'refresh', v)} />
            </div>
          </Section>

          <Section title="Editing" description="Shortcuts available in edit mode.">
            <div className="space-y-1">
              <KeybindingRow label="Exit Edit (Esc)" value={keybindings.content.generic.exitEdit} onChange={(v) => handleKeybindingChangeNested('content', 'generic', 'exitEdit', v)} />
              <KeybindingRow label="Select All" value={keybindings.content.generic.selectAll} onChange={(v) => handleKeybindingChangeNested('content', 'generic', 'selectAll', v)} />
              <KeybindingRow label="Cut" value={keybindings.content.generic.cut} onChange={(v) => handleKeybindingChangeNested('content', 'generic', 'cut', v)} />
              <KeybindingRow label="Copy" value={keybindings.content.generic.copy} onChange={(v) => handleKeybindingChangeNested('content', 'generic', 'copy', v)} />
              <KeybindingRow label="Paste" value={keybindings.content.generic.paste} onChange={(v) => handleKeybindingChangeNested('content', 'generic', 'paste', v)} />
            </div>
          </Section>
        </div>
      </div>
    </SettingsPage>
  );
}
