import { AlertCircle, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../shared/basic/Button'
import { Modal } from '../../shared/basic/Modal'
import { Section } from '../../shared/basic/Section'
import { SettingsPage } from '../../shared/featured/SettingsPage'
import type { SettingsState } from '../../shared/lib/types'
import { cn } from '../../shared/lib/utils'

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
  const { commands, availableCommands } = state
  const { setCommands, onPickCommandFolder } = actions

  const [folderToDelete, setFolderToDelete] = useState<string | null>(null)

  const handleAddFolder = async () => {
    const res = await onPickCommandFolder()
    if (res?.data) {
      const folders = commands?.folders || []
      const newFolders = [...folders, res.data]
      setCommands({ folders: Array.from(new Set(newFolders)) })
    }
  }

  const confirmRemoveFolder = () => {
    if (folderToDelete) {
      const folders = commands?.folders || []
      const newFolders = folders.filter((f) => f !== folderToDelete)
      setCommands({ folders: newFolders })
      setFolderToDelete(null)
    }
  }

  return (
    <SettingsPage
      title="Commands"
      description="Manage custom shell commands and automation tasks. You can add folders containing command definitions."
      onRestore={actions.onRestore}
    >
      <Section
        title="Command Source Folders"
        description="Directories where Aynite looks for command definitions."
        action={
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAddFolder}
            className="flex items-center gap-1.5 text-primary hover:bg-primary/10"
          >
            <Plus size={14} /> Add Folder
          </Button>
        }
      >
        <div className="space-y-2">
          {(commands?.folders || []).map((folder) => (
            <div
              key={folder}
              className="flex items-center justify-between p-3 rounded-lg border border-border bg-accent/10 group"
            >
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium truncate">
                  {folder.split(/[/\\]/).pop()}
                </span>
                <span className="text-[10px] text-muted-foreground truncate">
                  {folder}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setFolderToDelete(folder)}
                className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-all opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={16} />
              </Button>
            </div>
          ))}
          {(!commands?.folders || commands.folders.length === 0) && (
            <div className="py-8 text-center text-xs text-muted-foreground italic border border-dashed border-border rounded-lg">
              No command folders added.
            </div>
          )}
        </div>
      </Section>

      <Section
        title="Detected Commands"
        description="A list of all valid commands found in your folders."
      >
        <div className="grid grid-cols-2 gap-4">
          {availableCommands.map((cmd) => (
            <div
              key={cmd.path}
              className={cn(
                'p-4 rounded-xl border bg-accent/5 transition-all',
                cmd.error
                  ? 'border-destructive/30'
                  : 'border-border hover:border-border/60',
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                {cmd.error && (
                  <AlertCircle size={14} className="text-destructive" />
                )}
                <span
                  className={cn(
                    'text-xs font-bold uppercase tracking-wider',
                    cmd.error && 'text-destructive',
                  )}
                >
                  {cmd.name}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
                {cmd.description || 'No description available.'}
              </p>
              {cmd.error && (
                <div className="p-2 rounded bg-destructive/10 text-[9px] text-destructive font-mono leading-tight whitespace-pre-wrap border border-destructive/20">
                  {cmd.error}
                </div>
              )}
              {!cmd.error && (
                <div className="text-[9px] text-muted-foreground/40 truncate font-mono">
                  {cmd.path}
                </div>
              )}
            </div>
          ))}
          {availableCommands.length === 0 && (
            <div className="col-span-full py-8 text-center text-xs text-muted-foreground italic border border-dashed border-border rounded-lg opacity-50">
              No commands detected.
            </div>
          )}
        </div>
      </Section>

      <Modal
        isOpen={!!folderToDelete}
        onClose={() => setFolderToDelete(null)}
        title="Remove Command Folder"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setFolderToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmRemoveFolder}>
              Remove Folder
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Are you sure you want to remove the folder{' '}
          <span className="font-bold text-foreground">
            "{folderToDelete?.split(/[/\\]/).pop()}"
          </span>
          ? Commands from this directory will no longer be available.
        </p>
      </Modal>
    </SettingsPage>
  )
}
