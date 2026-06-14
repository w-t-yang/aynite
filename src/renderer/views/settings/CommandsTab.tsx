import type { SettingsState } from '../../shared/lib/types'
import { SettingsFolderTab } from './SettingsFolderTab'

interface CommandsTabProps {
  state: {
    commands: SettingsState['commands']
    availableCommands: {
      name: string
      description: string
      path: string
      error: string | null
    }[]
  }
  actions: {
    setCommands: (commands: SettingsState['commands']) => void
    onPickCommandFolder: () => Promise<any>
    onRestore?: () => void
    t: (key: string) => string
  }
}

export function CommandsTab({ state, actions }: CommandsTabProps) {
  return (
    <SettingsFolderTab
      prefix="commands"
      folders={state.commands || { folders: [] }}
      setFolders={actions.setCommands}
      items={state.availableCommands}
      onAddFolder={actions.onPickCommandFolder}
      onRestore={actions.onRestore}
      t={actions.t}
    />
  )
}
