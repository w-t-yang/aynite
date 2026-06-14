import { Copy, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Theme } from '../../../lib/constants/types'
import { configMutations } from '../../bridge/config'
import { themeMutations } from '../../bridge/theme'
import { Button } from '../../shared/basic/Button'
import { Input } from '../../shared/basic/Input'
import { Modal } from '../../shared/basic/Modal'
import { Section } from '../../shared/basic/Section'
import { ColorInput } from '../../shared/featured/ColorInput'
import { SelectionMenu } from '../../shared/featured/SelectionMenu'
import { SettingsPage } from '../../shared/featured/SettingsPage'
import { ThemePreview } from '../../shared/featured/ThemePreview'

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
}

interface AppearanceTabProps {
  state: {
    list: Theme[]
    activeId: string
    systemFonts: string[]
  }
  actions: {
    setThemes: (payload: { list: Theme[]; activeId: string }) => void
    onRestore?: () => void
    t: (key: string) => string
  }
}

export function AppearanceTab({ state, actions }: AppearanceTabProps) {
  const { list, activeId, systemFonts } = state
  const { t } = actions

  // Local state for immediate UI feedback
  const [localThemes, setLocalThemes] = useState(list)
  const [localActiveId, setLocalActiveId] = useState(activeId)
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)
  const [duplicateName, setDuplicateName] = useState('')
  const [duplicateError, setDuplicateError] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  // Sync from props if they change externally
  useEffect(() => {
    setLocalThemes(list)
    setLocalActiveId(activeId)
  }, [list, activeId])

  const editingTheme = localThemes.find((t) => t.id === localActiveId)

  const persist = (list: any[], activeId: string) => {
    actions.setThemes({ list, activeId })
  }

  const handleSelectTheme = (id: string) => {
    setLocalActiveId(id)
    persist(localThemes, id)
  }

  const handleUpdateTheme = async (updatedTheme: any) => {
    const newThemes = localThemes.map((t) =>
      t.id === updatedTheme.id ? updatedTheme : t,
    )
    setLocalThemes(newThemes)
    persist(newThemes, localActiveId)
    // Persist theme data to disk so iframes can load it
    await configMutations.set('theme', {
      id: updatedTheme.id,
      theme: updatedTheme,
    } as any)
  }

  const handleDeleteTheme = async () => {
    if (!editingTheme || editingTheme.isSystem) return
    const newThemes = localThemes.filter((t) => t.id !== editingTheme.id)
    const newActiveId = 'nord' // Fallback
    setLocalThemes(newThemes)
    setLocalActiveId(newActiveId)
    persist(newThemes, newActiveId)
    // Delete theme file from disk
    await themeMutations.delete(editingTheme.id)
    setShowDeleteModal(false)
  }

  const handleDuplicate = async () => {
    if (duplicateName.trim() && editingTheme) {
      const name = duplicateName.trim()
      const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')

      // Validation: Check for duplicate name or id
      const isDuplicate = localThemes.some(
        (t) => t.id === id || t.name.toLowerCase() === name.toLowerCase(),
      )
      if (isDuplicate) {
        setDuplicateError(t('appearance.duplicate.error'))
        return
      }

      const newTheme = {
        id,
        name,
        type: editingTheme.type,
        isSystem: false,
        colors: { ...editingTheme.colors },
        fonts: { ...(editingTheme.fonts || {}) },
      }
      const newThemes = [...localThemes, newTheme]
      setLocalThemes(newThemes)
      setLocalActiveId(id)
      persist(newThemes, id)
      // Persist theme data to disk so it survives reload
      await configMutations.set('theme', { id, theme: newTheme } as any)
      setShowDuplicateModal(false)
      setDuplicateName('')
      setDuplicateError('')
    }
  }

  return (
    <SettingsPage
      title={t('appearance.title')}
      description={t('appearance.description')}
      onRestore={actions.onRestore}
    >
      {/* Theme Presets */}
      <Section
        title={t('appearance.presets.title')}
        description={t('appearance.presets.description')}
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDuplicateModal(true)}
          >
            <Copy size={14} /> {t('appearance.duplicateTheme')}
          </Button>
        }
      >
        <div className="grid grid-cols-6 gap-6">
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
          title={t('appearance.customization.title')}
          description={t('appearance.customization.description').replace(
            '{name}',
            editingTheme.name,
          )}
          action={
            !editingTheme.isSystem && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDeleteModal(true)}
                className="text-destructive hover:bg-destructive/10"
              >
                <Trash2 size={16} />
              </Button>
            )
          }
        >
          <div className="space-y-12">
            {/* Fonts */}
            <div className="grid grid-cols-2 gap-x-12 gap-y-6 max-w-3xl">
              <SelectionMenu
                label={t('appearance.font.interface')}
                searchable
                activeId={editingTheme.fonts?.fontFamily || 'Inter'}
                items={systemFonts.map((f) => ({ id: f, label: f }))}
                onSelect={(v: string) =>
                  handleUpdateTheme({
                    ...editingTheme,
                    fonts: { ...(editingTheme.fonts || {}), fontFamily: v },
                  })
                }
              />
              <SelectionMenu
                label={t('appearance.font.monospace')}
                searchable
                activeId={editingTheme.fonts?.fontMono || 'JetBrains Mono'}
                items={systemFonts.map((f) => ({ id: f, label: f }))}
                onSelect={(v: string) =>
                  handleUpdateTheme({
                    ...editingTheme,
                    fonts: { ...(editingTheme.fonts || {}), fontMono: v },
                  })
                }
              />
              <SelectionMenu
                label={t('appearance.font.size')}
                activeId={editingTheme.fonts?.fontSize || '14px'}
                items={[
                  {
                    id: '12px',
                    label: `12px — ${t('appearance.font.sizeSmall')}`,
                  },
                  { id: '13px', label: '13px' },
                  {
                    id: '14px',
                    label: `14px — ${t('appearance.font.sizeDefault')}`,
                  },
                  { id: '15px', label: '15px' },
                  {
                    id: '16px',
                    label: `16px — ${t('appearance.font.sizeLarge')}`,
                  },
                  { id: '18px', label: '18px' },
                  { id: '20px', label: '20px' },
                ]}
                onSelect={(v: string) =>
                  handleUpdateTheme({
                    ...editingTheme,
                    fonts: { ...(editingTheme.fonts || {}), fontSize: v },
                  })
                }
              />
            </div>

            {/* Colors */}
            <div className="grid grid-cols-2 gap-x-16 gap-y-4">
              {Object.entries(editingTheme.colors).map(
                ([key, value]: [string, any]) => {
                  const handleColorChange = (v: string) =>
                    handleUpdateTheme({
                      ...editingTheme,
                      colors: { ...editingTheme.colors, [key]: v },
                    })
                  return (
                    <ColorInput
                      key={key}
                      label={COLOR_LABELS[key] || key}
                      value={value}
                      onPickerChange={handleColorChange}
                      onTextChange={handleColorChange}
                    />
                  )
                },
              )}
            </div>
          </div>
        </Section>
      )}

      {/* Duplicate Modal */}
      <Modal
        isOpen={showDuplicateModal}
        onClose={() => {
          setShowDuplicateModal(false)
          setDuplicateError('')
        }}
        title={t('appearance.duplicate.title')}
        size="md"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setShowDuplicateModal(false)}
            >
              {t('appearance.duplicate.cancel')}
            </Button>
            <Button variant="primary" onClick={handleDuplicate}>
              {t('appearance.duplicate.create')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            autoFocus
            label={t('appearance.duplicate.label')}
            placeholder={t('appearance.duplicate.placeholder')}
            value={duplicateName}
            onChange={(e) => {
              setDuplicateName(e.target.value)
              setDuplicateError('')
            }}
            className={
              duplicateError ? 'border-destructive focus:ring-destructive' : ''
            }
          />
          {duplicateError && (
            <p className="text-xs text-destructive font-medium">
              {duplicateError}
            </p>
          )}
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title={t('appearance.delete.title')}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowDeleteModal(false)}>
              {t('appearance.delete.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDeleteTheme}>
              {t('appearance.delete.confirm')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-foreground leading-relaxed">
            {t('appearance.delete.body').replace(
              '{name}',
              editingTheme?.name || '',
            )}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed bg-destructive/5 p-3 rounded-lg border border-destructive/10">
            {t('appearance.delete.warning')}
          </p>
        </div>
      </Modal>
    </SettingsPage>
  )
}
