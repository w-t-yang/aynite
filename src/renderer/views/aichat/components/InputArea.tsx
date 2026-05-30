import {
  AlertCircle,
  Brain,
  ClipboardList,
  FileCode,
  Layers,
  X,
} from 'lucide-react'
import { forwardRef } from 'react'
import { configMutations } from '../../../bridge/config'
import { Button } from '../../../shared/basic/Button'
import { SelectionMenu } from '../../../shared/featured/SelectionMenu'
import { cn } from '../../../shared/lib/utils'
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
  error: { message: string; redacted: string; type?: string } | null
  setError: (
    err: { message: string; redacted: string; type?: string } | null,
  ) => void
  artifactStatus: {
    memory: { exists: boolean; path: string }
    task: { exists: boolean; path: string }
    plan: { exists: boolean; path: string }
  } | null
  tokenCount: number
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
      artifactStatus,
      tokenCount,
    },
    ref,
  ) => {
    const executeOperation = useAppOperation()

    const artifactItems = [
      {
        id: artifactStatus?.memory?.path || 'memory',
        label: artifactStatus?.memory?.exists ? 'memory.md' : 'Not initialized',
        subtitle: 'Project Memory',
        icon: <Brain size={14} />,
        disabled: !artifactStatus?.memory?.exists,
      },
      {
        id: artifactStatus?.plan?.path || 'plan',
        label: artifactStatus?.plan?.exists
          ? 'implementation_plan.md'
          : 'Not proposed',
        subtitle: 'Implementation Plan',
        icon: <FileCode size={14} />,
        disabled: !artifactStatus?.plan?.exists,
      },
      {
        id: artifactStatus?.task?.path || 'task',
        label: artifactStatus?.task?.exists ? 'task.md' : 'Not created',
        subtitle: 'Task List',
        icon: <ClipboardList size={14} />,
        disabled: !artifactStatus?.task?.exists,
      },
    ]

    const onSelectArtifact = (path: string) => {
      if (path?.includes('/')) {
        configMutations.set('activeFile', path)
      }
    }

    const formatNumber = (num: number) => {
      if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`
      if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
      if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
      return num.toString()
    }

    return (
      <div className="absolute bottom-0 left-0 right-0 px-12 pb-10 bg-gradient-to-t from-background via-background to-transparent z-layout pointer-events-none">
        <div className="max-w-[900px] mx-auto relative group pointer-events-auto">
          <div className="flex items-center justify-between px-2 mb-2 animate-in fade-in slide-in-from-bottom-1 duration-500">
            <div className="flex items-center gap-2">
              <SelectionMenu
                items={artifactItems}
                onSelect={onSelectArtifact}
                side="top"
                trigger={
                  <Button
                    variant="ghost"
                    className="text-muted-foreground/30 hover:text-primary transition-colors focus:outline-none p-0 h-auto font-bold uppercase tracking-widest text-[9px] hover:bg-transparent flex items-center gap-1.5"
                  >
                    <Layers size={13} />
                    Artifacts
                  </Button>
                }
                title="Project Artifacts"
              />
            </div>

            {tokenCount > 0 && (
              <div
                className={cn(
                  'flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider cursor-help transition-all',
                  tokenCount >= 800_000
                    ? 'bg-destructive/10 border-destructive/20 text-destructive/80 hover:bg-destructive/15'
                    : tokenCount >= 500_000
                      ? 'bg-warning/10 border-warning/20 text-warning/80 hover:bg-warning/15'
                      : 'bg-foreground/[0.02] border-border/5 text-muted-foreground/40 hover:bg-foreground/[0.04] hover:text-muted-foreground/60',
                )}
                title={`Estimated context tokens used in this session: ${tokenCount.toLocaleString()}`}
              >
                <div
                  className={cn(
                    'w-1 h-1 rounded-full animate-pulse',
                    tokenCount >= 800_000
                      ? 'bg-destructive/60'
                      : tokenCount >= 500_000
                        ? 'bg-warning/60'
                        : 'bg-primary/30',
                  )}
                />
                {formatNumber(tokenCount)} tokens
              </div>
            )}
          </div>

          {error && (
            <div className="mb-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20 flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 shadow-xl backdrop-blur-md">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-destructive/80">
                  {error.type === 'tool'
                    ? 'Tool Execution Error'
                    : error.type === 'system'
                      ? 'System Error'
                      : 'AI Stream Error'}
                </p>
                <p className="text-xs text-foreground/90 leading-relaxed font-medium">
                  {error.redacted}
                </p>
                {(!error.type || error.type === 'provider') && (
                  <Button
                    variant="ghost"
                    onClick={() => executeOperation('SETTINGS', { tab: 'ai' })}
                    className="text-[11px] font-bold text-primary hover:text-primary/80 transition-colors mt-1 p-0 h-auto inline-flex"
                  >
                    Update AI Provider Settings →
                  </Button>
                )}
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
