import {
  ChevronDown,
  ChevronRight,
  File,
  Folder,
  FolderOpen,
  GitBranch,
} from 'lucide-react'
import type React from 'react'
import type { NodeRendererProps } from 'react-arborist'
import { Button } from '../../shared/basic/Button'
import { Input } from '../../shared/basic/Input'
import { cn } from '../../shared/lib/utils'

// ─── File Tree Node ────────────────────────────────────────────────

import type {
  DiffStats,
  FileNode,
  GitStatusType,
} from '../../../lib/types/files'

export type { FileNode }

export function NodeRenderer({
  node,
  style,
  dragHandle,
  onSelectFile,
  setContextMenu,
  dirtyFiles,
  activeFilePath,
  gitStatuses,
  gitRoots,
  diffStats,
  changesOnly,
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
      file: FileNode | null
    } | null,
  ) => void
  dirtyFiles: string[]
  activeFilePath?: string | null
  gitStatuses?: Record<string, GitStatusType>
  gitRoots?: Set<string>
  diffStats?: Record<string, DiffStats>
  changesOnly?: boolean
}) {
  const { name, isDirectory, id } = node.data
  const isSelected = node.isSelected
  const isActive = id === activeFilePath
  const isDirty = dirtyFiles.includes(id)

  const gitStatus = gitStatuses?.[id]
  const isGitRoot = gitRoots?.has(id)

  const diffStat = changesOnly && !isDirectory ? diffStats?.[id] : undefined

  const statusLabel = (() => {
    switch (gitStatus) {
      case 'modified':
        return { letter: 'M', className: 'text-amber-400' }
      case 'added':
        return { letter: 'A', className: 'text-green-400' }
      case 'untracked':
        return { letter: 'U', className: 'text-blue-400' }
      case 'deleted':
        return { letter: 'D', className: 'text-red-400' }
      case 'renamed':
        return { letter: 'R', className: 'text-purple-400' }
      default:
        return null
    }
  })()

  return (
    <div
      style={style}
      ref={dragHandle}
      className={cn(
        'flex items-center cursor-pointer hover:bg-accent text-sm select-none px-0.5 py-0.5 bg-card',
        isSelected || isActive
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
      {(isGitRoot || statusLabel || diffStat) && (
        <span className="ml-auto flex items-center gap-1 mr-1">
          {isGitRoot && (
            <GitBranch size={12} className="text-muted-foreground shrink-0" />
          )}
          {!isGitRoot && diffStat && (
            <span className="text-[10px] font-mono leading-none whitespace-nowrap">
              {diffStat.additions > 0 && (
                <span className="text-green-500">+{diffStat.additions}</span>
              )}
              {diffStat.additions > 0 && diffStat.deletions > 0 && (
                <span className="text-muted-foreground/40"> </span>
              )}
              {diffStat.deletions > 0 && (
                <span className="text-red-500">-{diffStat.deletions}</span>
              )}
            </span>
          )}
          {!isGitRoot && !diffStat && statusLabel && (
            <span
              className={`text-[10px] font-bold font-mono leading-none ${statusLabel.className}`}
            >
              {statusLabel.letter}
            </span>
          )}
        </span>
      )}
    </div>
  )
}

// ─── Modal Shell ────────────────────────────────────────────────────

function ModalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-modal bg-background/80 backdrop-blur-sm flex items-center justify-center">
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
  labels,
}: {
  title: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  onConfirm: (v: string) => void
  onCancel: () => void
  labels?: { cancel: string; confirm: string }
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
          {labels?.cancel || 'Cancel'}
        </Button>
        <Button
          variant="ghost"
          onClick={() => value.trim() && onConfirm(value.trim())}
          className="px-4 py-2 text-sm bg-primary text-primary-foreground hover:opacity-90 rounded-md transition-colors font-medium"
        >
          {labels?.confirm || 'Confirm'}
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
  labels,
}: {
  message: string
  onConfirm: () => void
  onCancel: () => void
  labels?: { cancel: string; delete: string }
}) {
  return (
    <ModalShell>
      <h3 className="text-lg font-medium mb-4 text-foreground">
        {labels?.delete || 'Confirm Deletion'}
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
          {labels?.cancel || 'Cancel'}
        </Button>
        <Button
          variant="ghost"
          onClick={onConfirm}
          className="px-4 py-2 text-sm bg-destructive text-destructive-foreground hover:opacity-90 rounded-md transition-colors font-medium"
        >
          {labels?.delete || 'Delete'}
        </Button>
      </div>
    </ModalShell>
  )
}
