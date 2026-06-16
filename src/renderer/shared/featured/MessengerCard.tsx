import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { DESCRIPTION_TEXT } from '../../../lib/constants/renderer/styles'
import type { MessengerConfig } from '../../../lib/types/ai'
import { Button } from '../basic/Button'
import { Input } from '../basic/Input'
import { Switch } from '../basic/Switch'
import { cn } from '../lib/utils'
import { DeleteItemModal } from './EditableCard'
import { SelectionMenu } from './SelectionMenu'

interface MessengerCardProps {
  messenger: MessengerConfig
  workspaces: string[]
  onUpdate: (id: string, field: string, value: any) => void
  onDelete: (id: string) => void
}

export function MessengerCard({
  messenger,
  workspaces,
  onUpdate,
  onDelete,
}: MessengerCardProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const isConfigured =
    messenger.name.trim() &&
    messenger.apiKey.trim() &&
    messenger.workspace.trim()

  const handleToggle = (enabled: boolean) => {
    if (enabled && !isConfigured) return // Cannot enable if not configured
    onUpdate(messenger.id, 'enabled', enabled)
  }

  return (
    <>
      <div
        className={cn(
          'p-5 rounded-xl border transition-all space-y-4',
          messenger.enabled
            ? 'border-primary bg-accent/5'
            : 'border-border bg-accent/5',
        )}
      >
        {/* Header without radio */}
        <div className="flex items-center justify-between">
          <Input
            unstyled
            className="font-bold w-64"
            value={messenger.name}
            onChange={(e) => onUpdate(messenger.id, 'name', e.target.value)}
            placeholder="Messenger Name"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowDeleteModal(true)}
            className="hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 size={16} />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4 ml-7">
          <div className="col-span-2">
            <Input
              label="API Key"
              type="password"
              value={messenger.apiKey}
              onChange={(e) => onUpdate(messenger.id, 'apiKey', e.target.value)}
              placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
            />
          </div>

          <div className="col-span-2">
            <SelectionMenu
              label="Workspace"
              activeId={messenger.workspace}
              onSelect={(v) => onUpdate(messenger.id, 'workspace', v)}
              items={workspaces.map((w) => ({ id: w, label: w }))}
              placeholder="Select workspace..."
            />
          </div>

          <div className="col-span-2 flex items-center gap-3 pt-1">
            <Switch
              checked={messenger.enabled}
              onCheckedChange={handleToggle}
            />
            <span className="text-xs font-medium text-muted-foreground">
              {messenger.enabled
                ? 'Enabled'
                : !isConfigured
                  ? 'Complete name, API key, and workspace to enable'
                  : 'Disabled'}
            </span>
          </div>
        </div>
      </div>

      <DeleteItemModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onDelete={() => onDelete(messenger.id)}
        title="Delete Messenger"
        itemName={messenger.name}
        deleteLabel="Delete Messenger"
      >
        <p className={DESCRIPTION_TEXT}>
          This action will permanently remove this messenger configuration.
        </p>
      </DeleteItemModal>
    </>
  )
}
