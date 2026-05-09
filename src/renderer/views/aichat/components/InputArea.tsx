import { AlertCircle, X } from 'lucide-react'
import { forwardRef } from 'react'
import { Button } from '../../../shared/basic/Button'
import { useAppOperation } from '../../ViewContext'
import { type ChatInputHandle, InputEditor } from './InputEditor'

interface InputAreaProps {
  loading: boolean
  onSend: (text: string) => void
  onAbort: () => void
  onClear: () => void
  workspaceFolders: string[]
  getAllFiles: () => Promise<any>
  getAvailableSkills: () => Promise<any>
  getAvailableCommands: () => Promise<any>
  error: { message: string; redacted: string } | null
  setError: (err: { message: string; redacted: string } | null) => void
}

export const InputArea = forwardRef<ChatInputHandle, InputAreaProps>(
  (
    {
      loading,
      onSend,
      onAbort,
      onClear,
      workspaceFolders,
      getAllFiles,
      getAvailableSkills,
      getAvailableCommands,
      error,
      setError,
    },
    ref,
  ) => {
    const executeOperation = useAppOperation()

    return (
      <div className="absolute bottom-0 left-0 right-0 px-12 pb-10 bg-gradient-to-t from-background via-background to-transparent z-layout pointer-events-none">
        <div className="max-w-[900px] mx-auto relative group pointer-events-auto">
          {error && (
            <div className="mb-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20 flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 shadow-xl backdrop-blur-md">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-destructive/80">
                  AI Stream Error
                </p>
                <p className="text-xs text-foreground/90 leading-relaxed font-medium">
                  {error.redacted}
                </p>
                <Button
                  variant="ghost"
                  onClick={() => executeOperation('SETTINGS', { tab: 'ai' })}
                  className="text-[11px] font-bold text-primary hover:text-primary/80 transition-colors mt-1 p-0 h-auto inline-flex"
                >
                  Update AI Provider Settings →
                </Button>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setError(null)}
                className="text-muted-foreground/40 hover:text-foreground transition-colors p-1"
              >
                <X size={14} />
              </Button>
            </div>
          )}
          <InputEditor
            ref={ref}
            placeholder="Type your message or use / for skills..."
            onSend={onSend}
            loading={loading}
            onAbort={onAbort}
            onClear={onClear}
            workspaceFolders={workspaceFolders}
            getAllFiles={getAllFiles}
            getAvailableSkills={getAvailableSkills}
            getAvailableCommands={getAvailableCommands}
          />
        </div>
      </div>
    )
  },
)

InputArea.displayName = 'InputArea'
