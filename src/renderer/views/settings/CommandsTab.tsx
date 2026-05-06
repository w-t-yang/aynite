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
  }
}

export function CommandsTab({ state, actions }: CommandsTabProps) {
  return (
    <SettingsFolderTab
      labels={{
        title: 'Commands',
        pageDescription:
          'Manage custom shell commands and automation tasks. You can add folders containing command definitions.',
        folderSectionTitle: 'Command Source Folders',
        folderSectionDescription:
          'Directories where Aynite looks for command definitions.',
        detectedSectionTitle: 'Detected Commands',
        detectedSectionDescription:
          'A list of all valid commands found in your folders.',
        addFolderLabel: 'Add Folder',
        noFoldersLabel: 'No command folders added.',
        noItemsLabel: 'No commands detected.',
        removeModalTitle: 'Remove Command Folder',
        removeModalBody: 'Are you sure you want to remove the folder',
      }}
      folders={state.commands}
      setFolders={actions.setCommands}
      items={state.availableCommands}
      onAddFolder={actions.onPickCommandFolder}
      onRestore={actions.onRestore}
    />
  )
}
