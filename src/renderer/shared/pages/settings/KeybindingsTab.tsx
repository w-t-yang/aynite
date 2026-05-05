import React from 'react';
import { SettingsState, Keybinding } from '../../lib/types';
import { KeybindingRow } from '../../featured/KeybindingRow';
import { SettingsPage } from '../../featured/SettingsPage';
import { Section } from '../../basic/Section';

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

  const formatKeybinding = (kb?: Keybinding): string => {
    if (!kb) return '';
    const parts = [];
    if (kb.ctrl) parts.push('Ctrl');
    if (kb.meta) parts.push('Cmd');
    if (kb.alt) parts.push('Alt');
    if (kb.shift) parts.push('Shift');
    if (kb.key) parts.push(kb.key.toUpperCase());
    return parts.join('+');
  };

  const parseKeybinding = (value: string): Keybinding => {
    const parts = value.split('+');
    const key = parts.pop()?.toLowerCase() || '';
    return {
      ctrl: parts.includes('Ctrl'),
      meta: parts.includes('Cmd'),
      alt: parts.includes('Alt'),
      shift: parts.includes('Shift'),
      key
    };
  };

  const handleKeybindingChange = (group: 'app' | 'view', type: string, value: string) => {
    const newKeybindings = { ...keybindings };
    newKeybindings[group] = { 
      ...newKeybindings[group], 
      [type]: parseKeybinding(value) 
    };
    setKeybindings(newKeybindings);
  };

  return (
    <SettingsPage
      title="Keybindings"
      description="Configure keyboard shortcuts for navigation, editing, and assistant actions. Shortcuts are automatically applied app-wide."
      onRestore={actions.onRestore}
    >
      <div className="grid grid-cols-2 gap-12">
        <div className="space-y-12">
          <Section title="Application" description="Global app-wide shortcuts.">
            <div className="space-y-1">
              <KeybindingRow label="Cycle Tile" value={formatKeybinding(keybindings.app['app:tile-cycle'])} onChange={(v) => handleKeybindingChange('app', 'app:tile-cycle', v)} />
              <KeybindingRow label="Split Vertical" value={formatKeybinding(keybindings.app['app:tile-split-vertical'])} onChange={(v) => handleKeybindingChange('app', 'app:tile-split-vertical', v)} />
              <KeybindingRow label="Split Horizontal" value={formatKeybinding(keybindings.app['app:tile-split-horizontal'])} onChange={(v) => handleKeybindingChange('app', 'app:tile-split-horizontal', v)} />
              <KeybindingRow label="Close Tile" value={formatKeybinding(keybindings.app['app:tile-close'])} onChange={(v) => handleKeybindingChange('app', 'app:tile-close', v)} />
              <KeybindingRow label="Refresh App" value={formatKeybinding(keybindings.app['app:refresh-app'])} onChange={(v) => handleKeybindingChange('app', 'app:refresh-app', v)} />
              <KeybindingRow label="Quit App" value={formatKeybinding(keybindings.app['app:quit'])} onChange={(v) => handleKeybindingChange('app', 'app:quit', v)} />
            </div>
          </Section>

          <Section title="Panels" description="Toggle sidebar and chat panels.">
            <div className="space-y-1">
              <KeybindingRow label="Toggle Left Panel" value={formatKeybinding(keybindings.app['app:toggle-left-panel'])} onChange={(v) => handleKeybindingChange('app', 'app:toggle-left-panel', v)} />
              <KeybindingRow label="Toggle Right Panel" value={formatKeybinding(keybindings.app['app:toggle-right-panel'])} onChange={(v) => handleKeybindingChange('app', 'app:toggle-right-panel', v)} />
              <KeybindingRow label="Focus Chat" value={formatKeybinding(keybindings.app['app:focus-chat'])} onChange={(v) => handleKeybindingChange('app', 'app:focus-chat', v)} />
              <KeybindingRow label="Focus Skills" value={formatKeybinding(keybindings.app['app:focus-skills'])} onChange={(v) => handleKeybindingChange('app', 'app:focus-skills', v)} />
              <KeybindingRow label="Focus Commands" value={formatKeybinding(keybindings.app['app:focus-commands'])} onChange={(v) => handleKeybindingChange('app', 'app:focus-commands', v)} />
              <KeybindingRow label="Submit Chat" value={formatKeybinding(keybindings.app['app:submit-chat'])} onChange={(v) => handleKeybindingChange('app', 'app:submit-chat', v)} />
            </div>
          </Section>
        </div>

        <div className="space-y-12">
          <Section title="View Control" description="Shortcuts for active views and editing.">
            <div className="space-y-1">
              <KeybindingRow label="Beginning of Line" value={formatKeybinding(keybindings.view['view:beginning-of-line'])} onChange={(v) => handleKeybindingChange('view', 'view:beginning-of-line', v)} />
              <KeybindingRow label="End of Line" value={formatKeybinding(keybindings.view['view:end-of-line'])} onChange={(v) => handleKeybindingChange('view', 'view:end-of-line', v)} />
              <KeybindingRow label="Kill Line" value={formatKeybinding(keybindings.view['view:kill-line'])} onChange={(v) => handleKeybindingChange('view', 'view:kill-line', v)} />
              <KeybindingRow label="Copy" value={formatKeybinding(keybindings.view['view:copy'])} onChange={(v) => handleKeybindingChange('view', 'view:copy', v)} />
              <KeybindingRow label="Paste" value={formatKeybinding(keybindings.view['view:paste'])} onChange={(v) => handleKeybindingChange('view', 'view:paste', v)} />
              <KeybindingRow label="Cut" value={formatKeybinding(keybindings.view['view:cut'])} onChange={(v) => handleKeybindingChange('view', 'view:cut', v)} />
              <KeybindingRow label="Next Line" value={formatKeybinding(keybindings.view['view:next-line'])} onChange={(v) => handleKeybindingChange('view', 'view:next-line', v)} />
              <KeybindingRow label="Previous Line" value={formatKeybinding(keybindings.view['view:previous-line'])} onChange={(v) => handleKeybindingChange('view', 'view:previous-line', v)} />
              <KeybindingRow label="Escape / Quit" value={formatKeybinding(keybindings.view['view:keyboard-quit'])} onChange={(v) => handleKeybindingChange('view', 'view:keyboard-quit', v)} />
            </div>
          </Section>
        </div>
      </div>
    </SettingsPage>
  );
}
