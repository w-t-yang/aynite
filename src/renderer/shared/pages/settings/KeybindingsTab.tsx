import React from 'react';
import { SettingsState } from '../../lib/types';
import { KeybindingRow } from '../../featured/KeybindingRow';

interface KeybindingsTabProps {
  state: {
    keybindings: SettingsState['keybindings'];
  };
  actions: {
    setKeybindings: (keybindings: SettingsState['keybindings']) => void;
  };
}

export function KeybindingsTab({
  state,
  actions
}: KeybindingsTabProps) {
  const { keybindings } = state;
  const { setKeybindings } = actions;

  const handleKeybindingChange = (group: string, type: string, value: string) => {
    const newKeybindings = { ...keybindings };
    // @ts-ignore
    newKeybindings[group] = { ...newKeybindings[group], [type]: value };
    setKeybindings(newKeybindings);
  };

  const handleKeybindingChangeNested = (group: string, subGroup: string, type: string, value: string) => {
    const newKeybindings = { ...keybindings };
    // @ts-ignore
    newKeybindings[group] = { 
      ...newKeybindings[group], 
      // @ts-ignore
      [subGroup]: { ...newKeybindings[group][subGroup], [type]: value } 
    };
    setKeybindings(newKeybindings);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <p className="text-sm text-muted-foreground mb-6">Configure keyboard shortcuts for navigation, editing, and assistant actions.</p>
      <div className="space-y-6 pb-10">
        <div className="space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-2 px-1">Global</div>
          <KeybindingRow label="Refresh App" value={keybindings.global.refresh} onChange={(v) => handleKeybindingChange('global', 'refresh', v)} />
          <KeybindingRow label="Quit App" value={keybindings.global.quit} onChange={(v) => handleKeybindingChange('global', 'quit', v)} />
        </div>
        <div className="space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-2 px-1 border-t border-border/20 pt-4">Explorer (Left Panel)</div>
          <KeybindingRow label="Toggle Left Panel" value={keybindings.explorer.toggleLeftPanel} onChange={(v) => handleKeybindingChange('explorer', 'toggleLeftPanel', v)} />
        </div>
        <div className="space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-2 px-1 border-t border-border/20 pt-4">Aynite Assistant (Right Panel)</div>
          <KeybindingRow label="Focus Chat Input" value={keybindings.agent.focusChat} onChange={(v) => handleKeybindingChange('agent', 'focusChat', v)} />
          <KeybindingRow label="Focus & Skills" value={keybindings.agent.focusSkills} onChange={(v) => handleKeybindingChange('agent', 'focusSkills', v)} />
          <KeybindingRow label="Focus & Commands" value={keybindings.agent.focusCommands} onChange={(v) => handleKeybindingChange('agent', 'focusCommands', v)} />
          <KeybindingRow label="Chat Submit" value={keybindings.agent.submit} onChange={(v) => handleKeybindingChange('agent', 'submit', v)} />
          <KeybindingRow label="Toggle Right Panel" value={keybindings.agent.toggleRightPanel} onChange={(v) => handleKeybindingChange('agent', 'toggleRightPanel', v)} />
        </div>
        <div className="space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-2 px-1 border-t border-border/20 pt-4">Content Navigation</div>
          <KeybindingRow label="Switch Tab" value={keybindings.content.navigation.switchTab} onChange={(v) => handleKeybindingChangeNested('content', 'navigation', 'switchTab', v)} />
          <KeybindingRow label="Close Active Tab" value={keybindings.content.navigation.closeTab} onChange={(v) => handleKeybindingChangeNested('content', 'navigation', 'closeTab', v)} />
          <KeybindingRow label="Focus Active Tab" value={keybindings.content.navigation.focusContent} onChange={(v) => handleKeybindingChangeNested('content', 'navigation', 'focusContent', v)} />
        </div>
        <div className="space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-2 px-1 border-t border-border/20 pt-4">Content Viewer (Read Only Mode)</div>
          <KeybindingRow label="Enter Edit Mode" value={keybindings.content.viewer.enterEdit} onChange={(v) => handleKeybindingChangeNested('content', 'viewer', 'enterEdit', v)} />
          <KeybindingRow label="Vim Move Down" value={keybindings.content.viewer.moveDown} onChange={(v) => handleKeybindingChangeNested('content', 'viewer', 'moveDown', v)} />
          <KeybindingRow label="Vim Move Up" value={keybindings.content.viewer.moveUp} onChange={(v) => handleKeybindingChangeNested('content', 'viewer', 'moveUp', v)} />
          <KeybindingRow label="Vim Move Left" value={keybindings.content.viewer.moveLeft} onChange={(v) => handleKeybindingChangeNested('content', 'viewer', 'moveLeft', v)} />
          <KeybindingRow label="Vim Move Right" value={keybindings.content.viewer.moveRight} onChange={(v) => handleKeybindingChangeNested('content', 'viewer', 'moveRight', v)} />
          <KeybindingRow label="Search Buffer" value={keybindings.content.viewer.search} onChange={(v) => handleKeybindingChangeNested('content', 'viewer', 'search', v)} />
          <KeybindingRow label="Refresh Tab / Revert" value={keybindings.content.viewer.refresh} onChange={(v) => handleKeybindingChangeNested('content', 'viewer', 'refresh', v)} />
        </div>
        <div className="space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-2 px-1 border-t border-border/20 pt-4">Content Generic (Read + Edit)</div>
          <KeybindingRow label="Exit Edit (Esc)" value={keybindings.content.generic.exitEdit} onChange={(v) => handleKeybindingChangeNested('content', 'generic', 'exitEdit', v)} />
          <KeybindingRow label="Select All" value={keybindings.content.generic.selectAll} onChange={(v) => handleKeybindingChangeNested('content', 'generic', 'selectAll', v)} />
          <KeybindingRow label="Delete Character" value={keybindings.content.generic.deleteForward} onChange={(v) => handleKeybindingChangeNested('content', 'generic', 'deleteForward', v)} />
          <KeybindingRow label="Cut" value={keybindings.content.generic.cut} onChange={(v) => handleKeybindingChangeNested('content', 'generic', 'cut', v)} />
          <KeybindingRow label="Copy" value={keybindings.content.generic.copy} onChange={(v) => handleKeybindingChangeNested('content', 'generic', 'copy', v)} />
          <KeybindingRow label="Paste" value={keybindings.content.generic.paste} onChange={(v) => handleKeybindingChangeNested('content', 'generic', 'paste', v)} />
          <KeybindingRow label="Go to Start of Line" value={keybindings.content.generic.startOfLine} onChange={(v) => handleKeybindingChangeNested('content', 'generic', 'startOfLine', v)} />
          <KeybindingRow label="Go to End of Line" value={keybindings.content.generic.endOfLine} onChange={(v) => handleKeybindingChangeNested('content', 'generic', 'endOfLine', v)} />
          <KeybindingRow label="Kill to End of Line" value={keybindings.content.generic.killLine} onChange={(v) => handleKeybindingChangeNested('content', 'generic', 'killLine', v)} />
          <KeybindingRow label="Prev Line" value={keybindings.content.generic.prevLine} onChange={(v) => handleKeybindingChangeNested('content', 'generic', 'prevLine', v)} />
          <KeybindingRow label="Next Line" value={keybindings.content.generic.nextLine} onChange={(v) => handleKeybindingChangeNested('content', 'generic', 'nextLine', v)} />
          <KeybindingRow label="Forward Character" value={keybindings.content.generic.forwardChar} onChange={(v) => handleKeybindingChangeNested('content', 'generic', 'forwardChar', v)} />
          <KeybindingRow label="Backward Character" value={keybindings.content.generic.backwardChar} onChange={(v) => handleKeybindingChangeNested('content', 'generic', 'backwardChar', v)} />
        </div>
      </div>
    </div>
  );
}
