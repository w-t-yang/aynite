import {
  ChevronDown,
  ChevronRight,
  File,
  Folder,
  FolderOpen,
} from 'lucide-react'
import type React from 'react'
import type { NodeRendererProps } from 'react-arborist'
import { Button } from '../../shared/basic/Button'
import { Input } from '../../shared/basic/Input'
import { cn } from '../../shared/lib/utils'

// ─── File Tree Node ────────────────────────────────────────────────

import type { FileNode } from '../../../lib/types/files'

export type { FileNode }

export function NodeRenderer({
  node,
  style,
  dragHandle,
  onSelectFile,
  setContextMenu,
  dirtyFiles,
}: NodeRendererProps<FileNode> & {
  onSelectFile: (file: {
    name: string
    isDirectory: boolean
    path: string
  }) => void
  setContextMenu: (
    menu: {
      x: number
      y: number
      file: FileNode
    } | null,
  ) => void
  dirtyFiles: string[]
}) {
  const { name, isDirectory, id } = node.data
  const isSelected = node.isSelected
  const isDirty = dirtyFiles.includes(id)

  return (
    <div
      style={style}
      ref={dragHandle}
      className={cn(
        'flex items-center cursor-pointer hover:bg-accent text-sm select-none px-0.5 py-0.5 bg-card',
        isSelected
          ? 'bg-primary/10 text-primary font-medium hover:bg-primary/20'
          : 'text-muted-foreground',
      )}
      role="treeitem"
      tabIndex={-1}
      onClick={(e: React.MouseEvent) => {
        node.handleClick(e)
        if (!e.metaKey && !e.ctrlKey && !e.shiftKey) {
          if (isDirectory) {
            node.toggle()
          } else {
            onSelectFile?.({ name, isDirectory, path: id })
          }
        }
      }}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          if (isDirectory) {
            node.toggle()
          } else {
            onSelectFile?.({ name, isDirectory, path: id })
          }
        }
      }}
      onContextMenu={(e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        node.select()
        setContextMenu({ x: e.clientX, y: e.clientY, file: node.data })
      }}
    >
      <span className="w-6 h-6 mr-1 flex items-center justify-center">
        {isDirectory ? (
          node.isOpen ? (
            <ChevronDown size={14} />
          ) : (
            <ChevronRight size={14} />
          )
        ) : null}
      </span>
      {isDirectory ? (
        node.isOpen ? (
          <FolderOpen size={14} className="mr-1.5 text-primary" />
        ) : (
          <Folder size={14} className="mr-1.5 text-primary" />
        )
      ) : (
        <File size={14} className="mr-1.5" />
      )}
      <span
        className={cn(
          'truncate text-foreground font-medium',
          isDirty && 'italic text-primary',
        )}
      >
        {name}
        {isDirty && ' •'}
      </span>
    </div>
  )
}

// ─── Modal Shell ────────────────────────────────────────────────────

function ModalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-sidebar border border-border shadow-xl rounded-xl p-5 w-80 max-w-[90vw]">
        {children}
      </div>
    </div>
  )
}

// ─── Prompt Modal ──────────────────────────────────────────────────

export function PromptModal({
  title,
  placeholder,
  value,
  onChange,
  onConfirm,
  onCancel,
}: {
  title: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  onConfirm: (v: string) => void
  onCancel: () => void
}) {
  return (
    <ModalShell>
      <h3 className="text-lg font-medium mb-4 text-foreground">{title}</h3>
      <Input
        autoFocus
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-background text-foreground border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary mb-4"
      />
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-muted-foreground hover:bg-accent rounded-md transition-colors"
        >
          Cancel
        </Button>
        <Button
          variant="ghost"
          onClick={() => value.trim() && onConfirm(value.trim())}
          className="px-4 py-2 text-sm bg-primary text-primary-foreground hover:opacity-90 rounded-md transition-colors font-medium"
        >
          Confirm
        </Button>
      </div>
    </ModalShell>
  )
}

// ─── Confirm Modal ─────────────────────────────────────────────────

export function ConfirmModal({
  message,
  onConfirm,
  onCancel,
}: {
  message: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <ModalShell>
      <h3 className="text-lg font-medium mb-4 text-foreground">
        Confirm Deletion
      </h3>
      <p className="text-sm text-muted-foreground mb-6 break-words">
        {message}
      </p>
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-foreground hover:bg-accent rounded-md transition-colors"
        >
          Cancel
        </Button>
        <Button
          variant="ghost"
          onClick={onConfirm}
          className="px-4 py-2 text-sm bg-destructive text-destructive-foreground hover:opacity-90 rounded-md transition-colors font-medium"
        >
          Delete
        </Button>
      </div>
    </ModalShell>
  )
}
