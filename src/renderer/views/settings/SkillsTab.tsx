import type { SettingsState } from '../../shared/lib/types'
import { SettingsFolderTab } from './SettingsFolderTab'

interface SkillsTabProps {
  state: {
    skills: SettingsState['skills']
    availableSkills: {
      name: string
      description: string
      path: string
      error: string | null
    }[]
  }
  actions: {
    setSkills: (skills: SettingsState['skills']) => void
    onPickSkillFolder: () => Promise<any>
    onRestore?: () => void
  }
}

export function SkillsTab({ state, actions }: SkillsTabProps) {
  return (
    <SettingsFolderTab
      labels={{
        title: 'Skills',
        pageDescription:
          "Extend the assistant's capabilities with custom scripts. You can add folders containing skill definitions that the assistant can execute.",
        folderSectionTitle: 'Skill Source Folders',
        folderSectionDescription:
          'Directories where Aynite looks for skill implementations.',
        detectedSectionTitle: 'Detected Skills',
        detectedSectionDescription:
          'A list of all skills found and parsed from your folders.',
        addFolderLabel: 'Add Folder',
        noFoldersLabel: 'No skill folders added.',
        noItemsLabel: 'No skills detected.',
        removeModalTitle: 'Remove Skill Folder',
        removeModalBody:
          'Are you sure you want to remove the folder',
      }}
      folders={state.skills}
      setFolders={actions.setSkills}
      items={state.availableSkills}
      onAddFolder={actions.onPickSkillFolder}
      onRestore={actions.onRestore}
    />
  )
}
