import { useCallback, useEffect, useState } from 'react'
import { config, configMutations } from '../../bridge/config'
import { spells, spellsMutations } from '../../bridge/spells'
import { SettingsFolderTab } from './SettingsFolderTab'

interface SkillsTabProps {
  onRestore?: () => void
  t: (key: string) => string
}

export function SkillsTab({ onRestore, t }: SkillsTabProps) {
  const [skills, setSkills] = useState<{ folders: string[] }>({ folders: [] })
  const [availableSkills, setAvailableSkills] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([config.get('skills'), spells.getAvailableSkills()]).then(
      ([cfg, items]: [any, any]) => {
        setSkills({ folders: cfg?.folders || [] })
        setAvailableSkills(items || [])
        setLoading(false)
      },
    )
  }, [])

  const saveSkills = useCallback(async (newSkills: { folders: string[] }) => {
    setSkills(newSkills)
    await configMutations.set('skills', newSkills)
  }, [])

  const handlePickFolder = useCallback(async () => {
    const folder = await spellsMutations.pickSkillFolder()
    if (folder) {
      const newFolders = Array.from(
        new Set([...(skills?.folders || []), folder]),
      )
      await saveSkills({ folders: newFolders })
      // Reload skills list after adding folder
      const items = await spells.getAvailableSkills()
      if (items) setAvailableSkills(items)
    }
    return null
  }, [skills, saveSkills])

  if (loading) return null

  return (
    <SettingsFolderTab
      prefix="skills"
      folders={skills}
      setFolders={saveSkills}
      items={availableSkills}
      onAddFolder={handlePickFolder}
      onRestore={onRestore}
      t={t}
    />
  )
}
