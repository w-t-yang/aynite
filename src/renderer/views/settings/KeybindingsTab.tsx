import { AppOperation, ViewOperation } from '../../../lib/constants/app'
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
      <div className="grid grid-cols-2 gap-12">
        <div className="space-y-12">
          <Section title="Application" description="Global app-wide shortcuts.">
            <div className="space-y-1">
              <KeybindingRow
                label="Cycle Tile"
                value={formatKeybinding(
                  keybindings.app[AppOperation.TILE_CYCLE],
                )}
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
                  handleKeybindingChange(
                    'app',
                    AppOperation.TILE_SPLIT_VERTICAL,
                    v,
                  )
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
                value={formatKeybinding(
                  keybindings.app[AppOperation.TILE_CLOSE],
                )}
                onChange={(v) =>
                  handleKeybindingChange('app', AppOperation.TILE_CLOSE, v)
                }
              />
              <KeybindingRow
                label="Refresh App"
                value={formatKeybinding(
                  keybindings.app[AppOperation.REFRESH_APP],
                )}
                onChange={(v) =>
                  handleKeybindingChange('app', AppOperation.REFRESH_APP, v)
                }
              />
              <KeybindingRow
                label="Quit App"
                value={formatKeybinding(keybindings.app[AppOperation.QUIT])}
                onChange={(v) =>
                  handleKeybindingChange('app', AppOperation.QUIT, v)
                }
              />
            </div>
          </Section>

          <Section title="Panels" description="Toggle sidebar and chat panels.">
            <div className="space-y-1">
              <KeybindingRow
                label="Toggle Left Panel"
                value={formatKeybinding(
                  keybindings.app[AppOperation.TOGGLE_LEFT_PANEL],
                )}
                onChange={(v) =>
                  handleKeybindingChange(
                    'app',
                    AppOperation.TOGGLE_LEFT_PANEL,
                    v,
                  )
                }
              />
              <KeybindingRow
                label="Toggle Right Panel"
                value={formatKeybinding(
                  keybindings.app[AppOperation.TOGGLE_RIGHT_PANEL],
                )}
                onChange={(v) =>
                  handleKeybindingChange(
                    'app',
                    AppOperation.TOGGLE_RIGHT_PANEL,
                    v,
                  )
                }
              />
              <KeybindingRow
                label="Focus Chat"
                value={formatKeybinding(
                  keybindings.app[AppOperation.FOCUS_CHAT],
                )}
                onChange={(v) =>
                  handleKeybindingChange('app', AppOperation.FOCUS_CHAT, v)
                }
              />
              <KeybindingRow
                label="Focus Skills"
                value={formatKeybinding(
                  keybindings.app[AppOperation.FOCUS_SKILLS],
                )}
                onChange={(v) =>
                  handleKeybindingChange('app', AppOperation.FOCUS_SKILLS, v)
                }
              />
              <KeybindingRow
                label="Focus Commands"
                value={formatKeybinding(
                  keybindings.app[AppOperation.FOCUS_COMMANDS],
                )}
                onChange={(v) =>
                  handleKeybindingChange('app', AppOperation.FOCUS_COMMANDS, v)
                }
              />
            </div>
          </Section>
        </div>

        <div className="space-y-12">
          <Section
            title="View Control"
            description="Shortcuts for active views and editing."
          >
            <div className="space-y-1">
              <KeybindingRow
                label="Beginning of Line"
                value={formatKeybinding(
                  keybindings.view[ViewOperation.BEGINNING_OF_LINE],
                )}
                onChange={(v) =>
                  handleKeybindingChange(
                    'view',
                    ViewOperation.BEGINNING_OF_LINE,
                    v,
                  )
                }
              />
              <KeybindingRow
                label="End of Line"
                value={formatKeybinding(
                  keybindings.view[ViewOperation.END_OF_LINE],
                )}
                onChange={(v) =>
                  handleKeybindingChange('view', ViewOperation.END_OF_LINE, v)
                }
              />
              <KeybindingRow
                label="Kill Line"
                value={formatKeybinding(
                  keybindings.view[ViewOperation.KILL_LINE],
                )}
                onChange={(v) =>
                  handleKeybindingChange('view', ViewOperation.KILL_LINE, v)
                }
              />
              <KeybindingRow
                label="Copy"
                value={formatKeybinding(keybindings.view[ViewOperation.COPY])}
                onChange={(v) =>
                  handleKeybindingChange('view', ViewOperation.COPY, v)
                }
              />
              <KeybindingRow
                label="Paste"
                value={formatKeybinding(keybindings.view[ViewOperation.PASTE])}
                onChange={(v) =>
                  handleKeybindingChange('view', ViewOperation.PASTE, v)
                }
              />
              <KeybindingRow
                label="Cut"
                value={formatKeybinding(keybindings.view[ViewOperation.CUT])}
                onChange={(v) =>
                  handleKeybindingChange('view', ViewOperation.CUT, v)
                }
              />
              <KeybindingRow
                label="Next Line"
                value={formatKeybinding(
                  keybindings.view[ViewOperation.NEXT_LINE],
                )}
                onChange={(v) =>
                  handleKeybindingChange('view', ViewOperation.NEXT_LINE, v)
                }
              />
              <KeybindingRow
                label="Previous Line"
                value={formatKeybinding(
                  keybindings.view[ViewOperation.PREVIOUS_LINE],
                )}
                onChange={(v) =>
                  handleKeybindingChange('view', ViewOperation.PREVIOUS_LINE, v)
                }
              />
              <KeybindingRow
                label="Escape / Quit"
                value={formatKeybinding(
                  keybindings.view[ViewOperation.KEYBOARD_QUIT],
                )}
                onChange={(v) =>
                  handleKeybindingChange('view', ViewOperation.KEYBOARD_QUIT, v)
                }
              />
            </div>
          </Section>
        </div>
      </div>
    </SettingsPage>
  )
}
