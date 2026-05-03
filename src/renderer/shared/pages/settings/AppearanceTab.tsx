import React, { useState, useEffect } from 'react';
import { Palette, RotateCcw, Trash2, Copy, Plus } from 'lucide-react';
import { Section } from '../../basic/Section';
import { SettingsPage } from '../../basic/SettingsPage';
import { ThemePreview } from '../../featured/ThemePreview';
import { ColorInput } from '../../featured/ColorInput';
import { SearchableSelect } from '../../featured/SearchableSelect';
import { Button } from '../../basic/Button';
import { Modal } from '../../basic/Modal';
import { Input } from '../../basic/Input';

const COLOR_LABELS: Record<string, string> = {
  background: 'Background',
  foreground: 'Foreground',
  primary: 'Primary Accent',
  'primary-foreground': 'Primary Text',
  sidebar: 'Sidebar BG',
  'sidebar-foreground': 'Sidebar Text',
  border: 'Border Color',
  input: 'Input BG',
  ring: 'Focus Ring',
  muted: 'Muted BG',
  'muted-foreground': 'Muted Text',
  accent: 'Accent Hover',
  'accent-foreground': 'Accent Text',
  popover: 'Popover BG',
  'popover-foreground': 'Popover Text',
  card: 'Card BG',
  'card-foreground': 'Card Text',
  destructive: 'Destructive',
  'destructive-foreground': 'Destructive Text',
  warning: 'Warning',
  success: 'Success',
};

interface AppearanceTabProps {
  state: {
    list: any[];
    activeId: string;
    systemFonts: string[];
  };
  actions: {
    setThemes: (payload: { list: any[], activeId: string }) => void;
    onRestore?: () => void;
  };
}

export function AppearanceTab({
  state,
  actions
}: AppearanceTabProps) {
  const { list, activeId, systemFonts } = state;
  
  // Local state for immediate UI feedback
  const [localThemes, setLocalThemes] = useState(list);
  const [localActiveId, setLocalActiveId] = useState(activeId);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateName, setDuplicateName] = useState('');
  const [duplicateError, setDuplicateError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Sync from props if they change externally
  useEffect(() => {
    setLocalThemes(list);
    setLocalActiveId(activeId);
  }, [list, activeId]);

  const editingTheme = localThemes.find(t => t.id === localActiveId);

  const persist = (list: any[], activeId: string) => {
    actions.setThemes({ list, activeId });
  };

  const handleSelectTheme = (id: string) => {
    setLocalActiveId(id);
    persist(localThemes, id);
  };

  const handleUpdateTheme = (updatedTheme: any) => {
    const newThemes = localThemes.map(t => t.id === updatedTheme.id ? updatedTheme : t);
    setLocalThemes(newThemes);
    persist(newThemes, localActiveId);
  };


  const handleDeleteTheme = () => {
    if (!editingTheme || editingTheme.isSystem) return;
    const newThemes = localThemes.filter(t => t.id !== editingTheme.id);
    const newActiveId = 'nord'; // Fallback
    setLocalThemes(newThemes);
    setLocalActiveId(newActiveId);
    persist(newThemes, newActiveId);
    setShowDeleteModal(false);
  };

  const handleDuplicate = () => {
    if (duplicateName.trim() && editingTheme) {
      const name = duplicateName.trim();
      const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

      // Validation: Check for duplicate name or id
      const isDuplicate = localThemes.some(t => t.id === id || t.name.toLowerCase() === name.toLowerCase());
      if (isDuplicate) {
        setDuplicateError('A theme with this name or ID already exists.');
        return;
      }

      const newTheme = { 
        id, 
        name, 
        type: editingTheme.type, 
        isSystem: false, 
        colors: { ...editingTheme.colors }, 
        fonts: { ...(editingTheme.fonts || {}) } 
      };
      const newThemes = [...localThemes, newTheme];
      setLocalThemes(newThemes);
      setLocalActiveId(id);
      persist(newThemes, id);
      setShowDuplicateModal(false);
      setDuplicateName('');
      setDuplicateError('');
    }
  };

  return (
    <SettingsPage
      title="Appearance"
      description="Customize the look and feel of your workspace with themes, custom colors, and typography."
      primaryAction={
        <div className="flex gap-2">
          {actions.onRestore && (
            <Button variant="ghost" size="sm" onClick={actions.onRestore} className="flex items-center gap-1.5 text-muted-foreground">
              <RotateCcw size={14} /> Restore
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowDuplicateModal(true)}>
            <Copy size={14} /> Duplicate
          </Button>
          {editingTheme && !editingTheme.isSystem && (
            <Button variant="destructive" size="sm" onClick={() => setShowDeleteModal(true)}>
              <Trash2 size={14} /> Delete
            </Button>
          )}
        </div>
      }
    >
      {/* Theme Presets */}
      <Section title="Theme Presets" description="Select a predefined theme to quickly change the aesthetic.">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {localThemes.map((theme) => (
            <ThemePreview
              key={theme.id}
              theme={theme}
              isActive={localActiveId === theme.id}
              onClick={() => handleSelectTheme(theme.id)}
            />
          ))}
        </div>
      </Section>

      {/* Theme Customization */}
      {editingTheme && (
        <Section 
          title="Active Theme Customization" 
          description={`Fine-tune the "${editingTheme.name}" theme's colors and fonts.`}
        >
          <div className="space-y-12">
            {/* Fonts */}
            <div className="grid grid-cols-2 gap-x-12 gap-y-6 max-w-3xl">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Interface Font</label>
                <SearchableSelect
                  value={editingTheme.fonts?.sans || 'Inter'}
                  options={systemFonts}
                  onChange={(v) => handleUpdateTheme({
                    ...editingTheme,
                    fonts: { ...(editingTheme.fonts || {}), sans: v }
                  })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Monospace Font</label>
                <SearchableSelect
                  value={editingTheme.fonts?.mono || 'JetBrains Mono'}
                  options={systemFonts}
                  onChange={(v) => handleUpdateTheme({
                    ...editingTheme,
                    fonts: { ...(editingTheme.fonts || {}), mono: v }
                  })}
                />
              </div>
            </div>

            {/* Colors */}
            <div className="grid grid-cols-2 gap-x-16 gap-y-4">
              {Object.entries(editingTheme.colors).map(([key, value]: [string, any]) => (
                <ColorInput
                  key={key}
                  label={COLOR_LABELS[key] || key}
                  value={value}
                  onPickerChange={(v) => handleUpdateTheme({
                    ...editingTheme,
                    colors: { ...editingTheme.colors, [key]: v }
                  })}
                  onTextChange={(v) => handleUpdateTheme({
                    ...editingTheme,
                    colors: { ...editingTheme.colors, [key]: v }
                  })}
                />
              ))}
            </div>
          </div>
        </Section>
      )}

      {/* Duplicate Modal */}
      <Modal
        isOpen={showDuplicateModal}
        onClose={() => {
          setShowDuplicateModal(false);
          setDuplicateError('');
        }}
        title="Duplicate Theme"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowDuplicateModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleDuplicate}>Create Theme</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input 
            autoFocus 
            label="New Theme Name"
            placeholder="e.g. My Dark Theme" 
            value={duplicateName} 
            onChange={(e) => {
              setDuplicateName(e.target.value);
              setDuplicateError('');
            }}
            className={duplicateError ? "border-destructive focus:ring-destructive" : ""}
          />
          {duplicateError && <p className="text-xs text-destructive font-medium">{duplicateError}</p>}
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Theme"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteTheme}>
              Delete Forever
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-foreground leading-relaxed">
            Are you sure you want to delete <span className="font-bold">"{editingTheme?.name}"</span>?
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed bg-destructive/5 p-3 rounded-lg border border-destructive/10">
            This action cannot be undone. All custom colors and font settings for this theme will be permanently removed from your configuration.
          </p>
        </div>
      </Modal>
    </SettingsPage>
  );
}
