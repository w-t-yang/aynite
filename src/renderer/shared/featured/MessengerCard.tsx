import { useState } from 'react'
import { DESCRIPTION_TEXT } from '../../../lib/constants/renderer/styles'
import type { MessengerConfig } from '../../../lib/types/ai'
import { Input } from '../basic/Input'
import { Switch } from '../basic/Switch'
import {
  DeleteItemModal,
  EditableCardFrame,
  EditableCardHeader,
} from './EditableCard'
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

  return (
    <>
      <EditableCardFrame isActive={true}>
        <EditableCardHeader
          radioName="messenger-item"
          isActive={true}
          onSetActive={() => {}}
          itemName={messenger.name}
          onNameChange={(v) => onUpdate(messenger.id, 'name', v)}
          placeholder="Messenger Name"
          onDeleteRequest={() => setShowDeleteModal(true)}
        />

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
              onCheckedChange={(v) => onUpdate(messenger.id, 'enabled', v)}
            />
            <span className="text-xs font-medium text-muted-foreground">
              {messenger.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
      </EditableCardFrame>

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
