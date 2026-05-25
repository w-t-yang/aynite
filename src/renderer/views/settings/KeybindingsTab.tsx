import { AppOperation } from '../../../lib/constants/app'
import { Section } from '../../shared/basic/Section'
import { KeybindingRow } from '../../shared/featured/KeybindingRow'
import { SettingsPage } from '../../shared/featured/SettingsPage'
import type { Keybinding, SettingsState } from '../../shared/lib/types'

interface KeybindingsTabProps {
  state: {
    keybindings: SettingsState['keybindings']
  }
  actions: {
    setKeybindings: (keybindings: SettingsState['keybindings']) => void
    onRestore?: () => void
  }
}

export function KeybindingsTab({ state, actions }: KeybindingsTabProps) {
  const { keybindings } = state
  const { setKeybindings } = actions

  const formatKeybinding = (kb?: Keybinding): string => {
    if (!kb) return ''
    const parts = []
    if (kb.ctrl) parts.push('Ctrl')
    if (kb.meta) parts.push('Cmd')
    if (kb.alt) parts.push('Alt')
    if (kb.shift) parts.push('Shift')
    if (kb.key) parts.push(kb.key.toUpperCase())
    return parts.join('+')
  }

  const parseKeybinding = (value: string): Keybinding => {
    const parts = value.split('+')
    const key = parts.pop()?.toLowerCase() || ''
    return {
      ctrl: parts.includes('Ctrl'),
      meta: parts.includes('Cmd'),
      alt: parts.includes('Alt'),
      shift: parts.includes('Shift'),
      key,
    }
  }

  const handleKeybindingChange = (
    group: 'app' | 'view',
    type: string,
    value: string,
  ) => {
    const newKeybindings = { ...keybindings }
    newKeybindings[group] = {
      ...newKeybindings[group],
      [type]: parseKeybinding(value),
    }
    setKeybindings(newKeybindings)
  }

  return (
    <SettingsPage
      title="Keybindings"
      description="Configure keyboard shortcuts for navigation, editing, and assistant actions. Shortcuts are automatically applied app-wide."
      onRestore={actions.onRestore}
    >
      <Section title="Application" description="Global app-wide shortcuts.">
        <div className="grid grid-cols-2 gap-x-12 gap-y-1">
          <KeybindingRow
            label="Cycle Tile"
            value={formatKeybinding(keybindings.app[AppOperation.TILE_CYCLE])}
            onChange={(v) =>
              handleKeybindingChange('app', AppOperation.TILE_CYCLE, v)
            }
          />
          <KeybindingRow
            label="Split Vertical"
            value={formatKeybinding(
              keybindings.app[AppOperation.TILE_SPLIT_VERTICAL],
            )}
            onChange={(v) =>
              handleKeybindingChange('app', AppOperation.TILE_SPLIT_VERTICAL, v)
            }
          />
          <KeybindingRow
            label="Split Horizontal"
            value={formatKeybinding(
              keybindings.app[AppOperation.TILE_SPLIT_HORIZONTAL],
            )}
            onChange={(v) =>
              handleKeybindingChange(
                'app',
                AppOperation.TILE_SPLIT_HORIZONTAL,
                v,
              )
            }
          />
          <KeybindingRow
            label="Close Tile"
            value={formatKeybinding(keybindings.app[AppOperation.TILE_CLOSE])}
            onChange={(v) =>
              handleKeybindingChange('app', AppOperation.TILE_CLOSE, v)
            }
          />
          <KeybindingRow
            label="Refresh Tile"
            value={formatKeybinding(keybindings.app[AppOperation.REFRESH_TILE])}
            onChange={(v) =>
              handleKeybindingChange('app', AppOperation.REFRESH_TILE, v)
            }
          />
        </div>
      </Section>
    </SettingsPage>
  )
}
