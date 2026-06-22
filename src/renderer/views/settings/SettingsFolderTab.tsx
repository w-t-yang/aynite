import { AlertCircle, FolderOpen, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  ADD_ITEM_BUTTON,
  FLEX_COL_MIN,
  GRID_2_COL,
} from '../../../lib/constants/renderer/styles'
import { Button } from '../../shared/basic/Button'
import { Modal } from '../../shared/basic/Modal'
import { Section } from '../../shared/basic/Section'
import { SettingsPage } from '../../shared/featured/SettingsPage'
import { cn } from '../../shared/lib/utils'

interface SpellItem {
  name: string
  description: string
  path: string
  error: string | null
}

interface SettingsFolderTabProps {
  prefix: string
  folders: { folders?: string[] }
  setFolders: (state: { folders: string[] }) => void
  items: SpellItem[]
  onAddFolder: () => Promise<any>
  onRestore?: () => void
  t: (key: string) => string
}

export function SettingsFolderTab({
  prefix,
  folders,
  setFolders,
  items,
  onAddFolder,
  onRestore,
  t: _t,
}: SettingsFolderTabProps) {
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null)

  const t = (key: string) => _t(`${prefix}.${key}`)

  const handleAddFolder = async () => {
    const res = await onAddFolder()
    if (res?.data) {
      const existing = folders?.folders || []
      const newFolders = [...existing, res.data]
      setFolders({ folders: Array.from(new Set(newFolders)) })
    }
  }

  const confirmRemoveFolder = () => {
    if (folderToDelete) {
      const existing = folders?.folders || []
      const newFolders = existing.filter((f) => f !== folderToDelete)
      setFolders({ folders: newFolders })
      setFolderToDelete(null)
    }
  }

  // Group items by their parent folder
  const { grouped, unmatched } = useMemo(() => {
    const folderPaths = folders?.folders || []
    const g = new Map<string, SpellItem[]>()
    const u: SpellItem[] = []

    for (const item of items) {
      let matched = false
      for (const folder of folderPaths) {
        const normalizedFolder = folder.replace(/\/?$/, '/')
        if (item.path.startsWith(normalizedFolder)) {
          const group = g.get(folder) || []
          group.push(item)
          g.set(folder, group)
          matched = true
          break
        }
      }
      if (!matched) {
        u.push(item)
      }
    }
    return { grouped: g, unmatched: u }
  }, [items, folders?.folders])

  const renderItem = (item: SpellItem) => (
    <div
      key={item.path}
      className={cn(
        'p-4 rounded-xl border bg-accent/5 transition-all',
        item.error
          ? 'border-destructive/30'
          : 'border-border hover:border-border/60',
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        {item.error && <AlertCircle size={14} className="text-destructive" />}
        <span
          className={cn(
            'text-xs font-bold uppercase tracking-wider',
            item.error && 'text-destructive',
          )}
        >
          {item.name}
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
        {item.description || t('noDescription')}
      </p>
      {item.error && (
        <div className="p-2 rounded bg-destructive/10 text-[9px] text-destructive font-mono leading-tight whitespace-pre-wrap border border-destructive/20">
          {item.error}
        </div>
      )}
      {!item.error && (
        <div className="text-[9px] text-muted-foreground/40 truncate font-mono">
          {item.path}
        </div>
      )}
    </div>
  )

  const folderPaths = folders?.folders || []

  return (
    <SettingsPage
      title={t('title')}
      description={t('pageDescription')}
      onRestore={onRestore}
    >
      <Section
        title={t('folderSectionTitle')}
        description={t('folderSectionDescription')}
        action={
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAddFolder}
            className={ADD_ITEM_BUTTON}
          >
            <Plus size={14} /> {t('addFolderLabel')}
          </Button>
        }
      >
        <div className="space-y-2">
          {(folders?.folders || []).map((folder) => {
            const count = grouped.get(folder)?.length ?? 0
            return (
              <div
                key={folder}
                className="flex items-center justify-between p-3 rounded-lg border border-border bg-accent/10 group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FolderOpen
                    size={14}
                    className="shrink-0 text-muted-foreground/40"
                  />
                  <div className={FLEX_COL_MIN}>
                    <span className="text-xs font-medium truncate">
                      {folder.split(/[/\\]/).pop()}
                    </span>
                    <span className="text-[10px] text-muted-foreground truncate">
                      {folder}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground/30 bg-accent/20 px-1.5 py-0.5 rounded shrink-0">
                    {count}
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
            )
          })}
          {(!folders?.folders || folders.folders.length === 0) && (
            <div className="py-8 text-center text-xs text-muted-foreground italic border border-dashed border-border rounded-lg">
              {t('noFoldersLabel')}
            </div>
          )}
        </div>
      </Section>

      <Section
        title={t('detectedSectionTitle')}
        description={t('detectedSectionDescription')}
      >
        {folderPaths.length > 0 ? (
          <div className="space-y-8">
            {folderPaths.map((folder) => {
              const groupItems = grouped.get(folder)
              if (!groupItems || groupItems.length === 0) return null
              const folderName = folder.split(/[/\\]/).pop() || folder
              return (
                <div key={folder} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <FolderOpen
                      size={13}
                      className="text-muted-foreground/40"
                    />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                      {folderName}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground/30">
                      {groupItems.length}
                    </span>
                  </div>
                  <div className={GRID_2_COL}>{groupItems.map(renderItem)}</div>
                </div>
              )
            })}
            {unmatched.length > 0 && (
              <div className="space-y-3 border-t border-border/30 pt-6">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                    Other
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground/30">
                    {unmatched.length}
                  </span>
                </div>
                <div className={GRID_2_COL}>{unmatched.map(renderItem)}</div>
              </div>
            )}
          </div>
        ) : (
          <div className={GRID_2_COL}>{items.map(renderItem)}</div>
        )}
        {items.length === 0 && (
          <div className="py-8 text-center text-xs text-muted-foreground italic border border-dashed border-border rounded-lg opacity-50">
            {t('noItemsLabel')}
          </div>
        )}
      </Section>

      <Modal
        isOpen={!!folderToDelete}
        onClose={() => setFolderToDelete(null)}
        title={t('removeModalTitle')}
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
          {t('removeModalBody')}{' '}
          <span className="font-bold text-foreground">
            "{folderToDelete?.split(/[/\\]/).pop()}"
          </span>
          ?
        </p>
      </Modal>
    </SettingsPage>
  )
}
