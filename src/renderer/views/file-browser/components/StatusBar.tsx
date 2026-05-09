import { Eye, Pencil, Save } from 'lucide-react'
import type { FileInfo } from '../../../../lib/types/files'
import { cn } from '../../../shared/lib/utils'

interface StatusBarProps {
  isEditing: boolean
  setIsEditing: (val: boolean) => void
  fileInfo: FileInfo | null
  content: string | null
  onSave?: () => void
  isDirty?: boolean
}

export function StatusBar({
  isEditing,
  setIsEditing,
  fileInfo,
  content,
  onSave,
  isDirty = false,
}: StatusBarProps) {
  const wordCount = content ? content.trim().split(/\s+/).length : 0

  return (
    <div className="h-10 shrink-0 bg-sidebar/80 backdrop-blur-md border-t border-border flex items-center px-4 justify-between text-[10px] text-muted-foreground font-sans tracking-wide">
      <div className="flex items-center gap-6">
        <div className="flex items-center bg-muted/30 rounded-lg p-0.5 border border-border/40">
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 rounded-md transition-all duration-200 uppercase tracking-wider font-bold',
              !isEditing
                ? 'bg-background text-primary shadow-sm'
                : 'text-muted-foreground/60 hover:text-foreground',
            )}
          >
            <Eye size={12} />
            <span>View</span>
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 rounded-md transition-all duration-200 uppercase tracking-wider font-bold',
              isEditing
                ? 'bg-background text-primary shadow-sm'
                : 'text-muted-foreground/60 hover:text-foreground',
            )}
          >
            <Pencil size={12} />
            <span>Edit</span>
          </button>
        </div>

        {isEditing && (
          <button
            type="button"
            onClick={onSave}
            disabled={!isDirty}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 border rounded-md font-black uppercase tracking-widest transition-all text-[9px]',
              isDirty
                ? 'bg-primary/10 text-primary hover:bg-primary/20 border-primary/20 cursor-pointer'
                : 'bg-muted/10 text-muted-foreground/30 border-border/20 cursor-not-allowed opacity-50',
            )}
          >
            <Save size={12} />
            <span>Save</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-6 font-medium opacity-80 uppercase tracking-tight">
        <div className="flex items-center gap-1.5">
          <span className="opacity-40">Words</span>
          <span className="text-foreground/70">{wordCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>UTF-8</span>
          <div className="w-px h-3 bg-border/40" />
          <span>LF</span>
          <div className="w-px h-3 bg-border/40" />
          <span className="text-foreground/60 font-black">
            {fileInfo?.extension || 'txt'}
          </span>
        </div>
      </div>
    </div>
  )
}
