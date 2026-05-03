import React, { useState, useEffect } from 'react';
import { Palette, RotateCcw, Trash2, Copy } from 'lucide-react';
import { Section } from '../../basic/Section';
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
    <div className="space-y-12">
      {/* Theme Presets */}
      <Section title="Theme Preset" icon={<Palette size={16} />}>
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
          title="Active Theme Editor" 
          icon={<Palette size={16} />}
          action={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowDuplicateModal(true)}>
                <Copy size={12} /> Duplicate
              </Button>
              {!editingTheme.isSystem && (
                <Button variant="ghost" size="sm" onClick={() => setShowDeleteModal(true)} className="text-destructive hover:bg-destructive/10">
                  <Trash2 size={12} /> Delete
                </Button>
              )}
            </div>
          }
        >
          <div className="space-y-8">
            {/* Fonts */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
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
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Mono Font</label>
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
            <div className="grid grid-cols-2 gap-x-12 gap-y-2">
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
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowDuplicateModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleDuplicate}>Create Theme</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">New Theme Name</label>
            <Input 
              autoFocus 
              placeholder="e.g. My Dark Theme" 
              value={duplicateName} 
              onChange={(v) => {
                setDuplicateName(v);
                setDuplicateError('');
              }}
              className={duplicateError ? "border-destructive focus:ring-destructive" : ""}
            />
            {duplicateError && <p className="text-[10px] text-destructive font-medium">{duplicateError}</p>}
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Theme"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleDeleteTheme} className="bg-destructive hover:bg-destructive/90 text-white border-none">
              Delete Forever
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-foreground">Are you sure you want to delete <span className="font-bold">"{editingTheme?.name}"</span>?</p>
          <p className="text-xs text-muted-foreground leading-relaxed">This action cannot be undone. All custom colors and font settings for this theme will be permanently removed.</p>
        </div>
      </Modal>
    </div>
  );
}
