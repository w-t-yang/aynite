import { Plus, Trash2 } from 'lucide-react'
import type React from 'react'
import { useState } from 'react'
import { Button } from '../basic/Button'
import { SECTION_LABEL } from '../lib/styles'
import { EditableCardFrame, EditableCardHeader, DeleteItemModal } from './EditableCard'

interface PromptFileRowProps {
  filePath: string
  onDelete: () => void
}

export function PromptFileRow({ filePath, onDelete }: PromptFileRowProps) {
  return (
    <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-accent/5 group">
      <div className="flex flex-col min-w-0">
        <span className="text-xs font-medium truncate">
          {filePath.split(/[/\\]/).pop()}
        </span>
        <span className="text-[10px] text-muted-foreground truncate">
          {filePath}
        </span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-all opacity-0 group-hover:opacity-100"
      >
        <Trash2 size={14} />
      </Button>
    </div>
  )
}

interface AgentCardProps {
  agent: any
  isActive: boolean
  onSetActive: (id: string) => void
  onUpdate: (id: string, field: string, value: any) => void
  onDelete: (id: string) => void
  onPickPromptFile: (id: string) => void
  children?: React.ReactNode
}

export function AgentCard({
  agent,
  isActive,
  onSetActive,
  onUpdate,
  onDelete,
  onPickPromptFile,
  children,
}: AgentCardProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  return (
    <>
      <EditableCardFrame isActive={isActive}>
        <EditableCardHeader
          radioName="active-agent"
          isActive={isActive}
          onSetActive={() => onSetActive(agent.id)}
          itemName={agent.name}
          onNameChange={(v) => onUpdate(agent.id, 'name', v)}
          placeholder="Agent Name"
          onDeleteRequest={() => setShowDeleteModal(true)}
        />

        <div className="ml-7 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className={SECTION_LABEL}>
              Agent Prompt Files
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPickPromptFile(agent.id)}
              className="h-7 py-0 px-2 text-[10px] text-primary hover:bg-primary/10"
            >
              <Plus size={12} /> Add File
            </Button>
          </div>
          <div className="space-y-2">
            {(agent.promptFiles || []).map((filePath: string) => (
              <PromptFileRow
                key={filePath}
                filePath={filePath}
                onDelete={() => {
                  const newFiles = agent.promptFiles.filter(
                    (f: string) => f !== filePath,
                  )
                  onUpdate(agent.id, 'promptFiles', newFiles)
                }}
              />
            ))}
            {(!agent.promptFiles || agent.promptFiles.length === 0) && (
              <p className="text-[10px] text-muted-foreground/40 italic">
                No agent-specific prompts.
              </p>
            )}
          </div>

          {/* Integrated Preview or other children */}
          {children}
        </div>
      </EditableCardFrame>

      <DeleteItemModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onDelete={() => onDelete(agent.id)}
        title="Delete Agent Profile"
        itemName={agent.name}
        deleteLabel="Delete Agent"
      >
        <p className="text-sm text-muted-foreground leading-relaxed">
          All agent-specific configurations will be lost.
        </p>
      </DeleteItemModal>
    </>
  )
}
