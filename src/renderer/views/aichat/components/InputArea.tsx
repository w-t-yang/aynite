import { Check, Copy, History } from 'lucide-react'
import { forwardRef } from 'react'
import { Button } from '../../../shared/basic/Button'
import { cn } from '../../../shared/lib/utils'
import { type ChatInputHandle, InputEditor } from './InputEditor'

interface InputAreaProps {
  loading: boolean
  copied: boolean
  onSend: (text: string) => void
  onAbort: () => void
  onClear: () => void
  onShowHistory: () => void
  onCopyHistory: () => void
  getFiles: (path: string) => Promise<any>
  getAvailableSkills: () => Promise<any>
  getAvailableCommands: () => Promise<any>
}

export const InputArea = forwardRef<ChatInputHandle, InputAreaProps>(
  (
    {
      loading,
      copied,
      onSend,
      onAbort,
      onClear,
      onShowHistory,
      onCopyHistory,
      getFiles,
      getAvailableSkills,
      getAvailableCommands,
    },
    ref,
  ) => {
    return (
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background via-background to-transparent z-layout">
        <div className="max-w-4xl mx-auto relative group">
          <InputEditor
            ref={ref}
            placeholder="Type your message or use / for skills..."
            onSend={onSend}
            loading={loading}
            onAbort={onAbort}
            onClear={onClear}
            onShowHistory={onShowHistory}
            getFiles={getFiles}
            getAvailableSkills={getAvailableSkills}
            getAvailableCommands={getAvailableCommands}
          />

          {/* Micro Action Bar */}
          <div className="absolute -top-8 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <Button
              variant="ghost"
              size="icon"
              onClick={onCopyHistory}
              className={cn(
                'p-1.5 rounded bg-muted/50 hover:bg-accent text-muted-foreground hover:text-foreground transition-all flex items-center gap-1.5 h-auto w-auto',
                copied && 'text-green-500',
              )}
              title="Copy Chat"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              <span className="text-[9px] font-bold uppercase">Copy</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onShowHistory}
              className="p-1.5 rounded bg-muted/50 hover:bg-accent text-muted-foreground hover:text-foreground transition-all flex items-center gap-1.5 h-auto w-auto"
              title="Session History"
            >
              <History size={12} />
              <span className="text-[9px] font-bold uppercase">Logs</span>
            </Button>
          </div>
        </div>
      </div>
    )
  },
)

InputArea.displayName = 'InputArea'
