import { useCallback, useEffect, useState } from 'react'
import { config, configMutations } from '../../bridge/config'
import { spells, spellsMutations } from '../../bridge/spells'
import { SettingsFolderTab } from './SettingsFolderTab'

interface CommandsTabProps {
  onRestore?: () => void
  t: (key: string) => string
}

export function CommandsTab({ onRestore, t }: CommandsTabProps) {
  const [commands, setCommands] = useState<{ folders: string[] }>({
    folders: [],
  })
  const [availableCommands, setAvailableCommands] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([config.get('commands'), spells.getAvailableCommands()]).then(
      ([cfg, items]: [any, any]) => {
        setCommands({ folders: cfg?.folders || [] })
        setAvailableCommands(items || [])
        setLoading(false)
      },
    )
  }, [])

  const saveCommands = useCallback(async (newCmds: { folders: string[] }) => {
    setCommands(newCmds)
    await configMutations.set('commands', newCmds)
  }, [])

  const handlePickFolder = useCallback(async () => {
    const folder = await spellsMutations.pickCommandFolder()
    if (folder) {
      const newFolders = Array.from(
        new Set([...(commands?.folders || []), folder]),
      )
      await saveCommands({ folders: newFolders })
      const items = await spells.getAvailableCommands()
      if (items) setAvailableCommands(items)
    }
    return null
  }, [commands, saveCommands])

  if (loading) return null

  return (
    <SettingsFolderTab
      prefix="commands"
      folders={commands}
      setFolders={saveCommands}
      items={availableCommands}
      onAddFolder={handlePickFolder}
      onRestore={onRestore}
      t={t}
    />
  )
}
