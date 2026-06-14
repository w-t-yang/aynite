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
    t: (key: string) => string
  }
}

export function SkillsTab({ state, actions }: SkillsTabProps) {
  return (
    <SettingsFolderTab
      prefix="skills"
      folders={state.skills || { folders: [] }}
      setFolders={actions.setSkills}
      items={state.availableSkills}
      onAddFolder={actions.onPickSkillFolder}
      onRestore={actions.onRestore}
      t={actions.t}
    />
  )
}
