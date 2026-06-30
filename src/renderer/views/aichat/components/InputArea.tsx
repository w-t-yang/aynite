import {
  AlertCircle,
  Folder,
  FolderOpen,
  Gauge,
  Layers,
  ShieldCheck,
  X,
} from 'lucide-react'
import { forwardRef, useEffect, useState } from 'react'
import { configMutations } from '../../../bridge/config'
import { Button } from '../../../shared/basic/Button'
import { Input } from '../../../shared/basic/Input'
import { Switch } from '../../../shared/basic/Switch'
import { SelectionMenu } from '../../../shared/featured/SelectionMenu'
import { cn } from '../../../shared/lib/utils'
import { useAppOperation } from '../../ViewContext'
import { type ChatInputHandle, InputEditor } from './InputEditor'

interface InputAreaProps {
  loading: boolean
  compacting: boolean
  onSend: (text: string) => void
  onAbort: () => void
  onClear: () => void
  onCompact: () => void
  autoCompactThreshold: number
  onAutoCompactThresholdChange: (value: number) => void
  workspaceFolders: string[]
  activeProjectFolder: string | null
  onSetActiveProjectFolder: (folder: string) => void
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
  reasoningEffort: string
  onSetReasoningEffort: (effort: string) => void
  autoApprove: boolean
  onSetAutoApprove: (enabled: boolean) => void
  t?: (key: string) => string
}

const REASONING_ITEMS = [
  { id: 'off', label: 'Off (Fastest)', icon: <Gauge size={12} /> },
  { id: 'low', label: 'Low', icon: <Gauge size={12} /> },
  { id: 'medium', label: 'Medium', icon: <Gauge size={12} /> },
  { id: 'high', label: 'High (Deep Thinking)', icon: <Gauge size={12} /> },
]

export const InputArea = forwardRef<ChatInputHandle, InputAreaProps>(
  (
    {
      loading,
      compacting,
      onSend,
      onAbort,
      onClear,
      onCompact,
      autoCompactThreshold,
      onAutoCompactThresholdChange,
      workspaceFolders,
      activeProjectFolder,
      onSetActiveProjectFolder,
      getAllFiles,
      getAvailableSkills,
      getAvailableCommands,
      error,
      setError,
      artifactStatus,
      tokenCount,
      reasoningEffort,
      onSetReasoningEffort,
      autoApprove,
      onSetAutoApprove,
      t = (key: string) => key,
    },
    ref,
  ) => {
    const executeOperation = useAppOperation()

    const [localThreshold, setLocalThreshold] = useState(
      typeof autoCompactThreshold === 'number' &&
        autoCompactThreshold >= 200_000
        ? autoCompactThreshold
        : 500_000,
    )

    // Sync local threshold when prop changes
    useEffect(() => {
      const valid =
        typeof autoCompactThreshold === 'number' &&
        autoCompactThreshold >= 200_000
      setLocalThreshold(valid ? autoCompactThreshold : 500_000)
    }, [autoCompactThreshold])

    const thresholdK = Number.isFinite(localThreshold)
      ? Math.round(localThreshold / 1000)
      : 500
    const MIN_THRESHOLD = 200_000
    const MAX_THRESHOLD = 800_000
    const STEP = 100_000

    // Build project folder items from workspace folders
    const projectFolderItems = workspaceFolders.map((folder) => {
      const folderName = folder.split(/[/\\]/).pop() || folder
      const isActive = folder === activeProjectFolder
      return {
        id: folder,
        label: folderName,
        subtitle: folder,
        icon: isActive ? <FolderOpen size={14} /> : <Folder size={14} />,
        isActive,
      }
    })

    const activeFolderName = activeProjectFolder
      ? activeProjectFolder.split(/[/\\]/).pop() || activeProjectFolder
      : workspaceFolders.length > 0
        ? workspaceFolders[0].split(/[/\\]/).pop() || workspaceFolders[0]
        : 'No folders'

    const formatNumber = (num: number) => {
      if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`
      if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
      if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
      return num.toString()
    }

    return (
      <div className="pb-8 bg-gradient-to-t from-card/50 via-card/20 to-transparent z-layout pointer-events-none">
        <div className="max-w-[900px] mx-auto relative group pointer-events-auto">
          <div className="flex items-center justify-between px-2 mb-2 animate-in fade-in slide-in-from-bottom-1 duration-500">
            <div className="flex items-center gap-2">
              {projectFolderItems.length > 0 && (
                <SelectionMenu
                  items={projectFolderItems}
                  activeId={activeProjectFolder || ''}
                  onSelect={(folder) => {
                    onSetActiveProjectFolder(folder)
                    configMutations
                      .set('activeProjectFolder', folder)
                      .catch(() => {})
                  }}
                  side="top"
                  trigger={
                    <Button
                      variant="ghost"
                      className="mt-[8px] text-muted-foreground/40 hover:text-primary transition-colors focus:outline-none p-0 h-auto font-bold uppercase tracking-widest text-[9px] hover:bg-transparent flex items-center gap-1.5"
                    >
                      <Layers size={13} />
                      {activeFolderName}
                    </Button>
                  }
                  title={t('input.projectFolder')}
                />
              )}
              <span className="text-muted-foreground/15 font-normal select-none text-[9px]">
                /
              </span>
              <SelectionMenu
                items={REASONING_ITEMS}
                activeId={reasoningEffort}
                onSelect={onSetReasoningEffort}
                side="top"
                trigger={
                  <Button
                    variant="ghost"
                    className="mt-[8px] text-muted-foreground/40 hover:text-primary transition-colors focus:outline-none p-0 h-auto font-bold uppercase tracking-widest text-[9px] hover:bg-transparent flex items-center gap-1.5"
                  >
                    <Gauge size={13} />
                    {reasoningEffort === 'off'
                      ? 'No Reasoning'
                      : reasoningEffort}
                  </Button>
                }
                title={t('header.reasoningEffort')}
              />
              <span className="text-muted-foreground/15 font-normal select-none text-[9px]">
                /
              </span>
              <SelectionMenu
                items={[]}
                onSelect={() => {}}
                side="top"
                trigger={
                  <Button
                    variant="ghost"
                    className="mt-[8px] text-muted-foreground/40 hover:text-primary transition-colors focus:outline-none p-0 h-auto font-bold uppercase tracking-widest text-[9px] hover:bg-transparent flex items-center gap-1.5"
                  >
                    <ShieldCheck size={13} />
                    Auto Approve: {autoApprove ? 'On' : 'Off'}
                  </Button>
                }
                title={t('header.autoApprove')}
                footer={
                  <div className="px-3 py-2.5 flex items-center justify-between gap-3 min-w-[180px]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">
                      Auto Approve: {autoApprove ? 'On' : 'Off'}
                    </span>
                    <Switch
                      checked={autoApprove}
                      onCheckedChange={onSetAutoApprove}
                    />
                  </div>
                }
              />
            </div>

            {(tokenCount > 0 || compacting) && (
              <SelectionMenu
                items={[]}
                onSelect={() => {}}
                side="top"
                align="right"
                footer={
                  <div className="px-3 py-2.5 w-[240px] space-y-3">
                    <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                      {t('tokens.info')}
                    </p>
                    <div className="border-t border-border/10 pt-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Gauge
                          size={12}
                          className="text-muted-foreground/40 shrink-0"
                        />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">
                          {t('compact.autoThreshold')}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Input
                          type="range"
                          unstyled
                          min={MIN_THRESHOLD}
                          max={MAX_THRESHOLD}
                          step={STEP}
                          value={localThreshold}
                          onChange={(e) => {
                            const val = Number(e.target.value)
                            if (
                              Number.isFinite(val) &&
                              val >= MIN_THRESHOLD &&
                              val <= MAX_THRESHOLD
                            ) {
                              setLocalThreshold(val)
                              onAutoCompactThresholdChange(val)
                            }
                          }}
                          className="flex-1 h-1.5 appearance-none bg-border/40 rounded-full cursor-pointer accent-primary
                            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
                            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md
                            [&::-webkit-slider-thumb]:cursor-grab active:[&::-webkit-slider-thumb]:cursor-grabbing"
                        />
                        <span className="text-[10px] font-mono font-bold text-muted-foreground/60 w-[52px] text-right shrink-0">
                          {thresholdK}K
                        </span>
                      </div>
                    </div>
                    <div className="border-t border-border/10 pt-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">
                          {t('compact.manualCompact')}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        disabled={compacting || loading}
                        onClick={onCompact}
                        className="w-full text-[10px] font-bold uppercase tracking-wider h-7 rounded-lg bg-primary/5 hover:bg-primary/10 text-primary/70 hover:text-primary transition-all"
                      >
                        {compacting
                          ? t('compact.compacting')
                          : t('compact.buttonNow')}
                      </Button>
                    </div>
                  </div>
                }
                trigger={
                  <div
                    className={cn(
                      'flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider cursor-pointer transition-all select-none',
                      compacting
                        ? 'bg-primary/10 border-primary/20 text-primary/60'
                        : tokenCount >= 800_000
                          ? 'bg-destructive/10 border-destructive/20 text-destructive/80 hover:bg-destructive/15'
                          : tokenCount >= 500_000
                            ? 'bg-warning/10 border-warning/20 text-warning/80 hover:bg-warning/15'
                            : 'bg-foreground/[0.02] border-border/5 text-muted-foreground/40 hover:bg-foreground/[0.04] hover:text-muted-foreground/60',
                    )}
                  >
                    <div
                      className={cn(
                        'w-1 h-1 rounded-full animate-pulse',
                        compacting
                          ? 'bg-primary/60'
                          : tokenCount >= 800_000
                            ? 'bg-destructive/60'
                            : tokenCount >= 500_000
                              ? 'bg-warning/60'
                              : 'bg-primary/30',
                      )}
                    />
                    {compacting
                      ? t('compact.compacting')
                      : `${formatNumber(tokenCount)} tokens`}
                  </div>
                }
                title={t('input.contextTokens')}
              />
            )}
          </div>

          {error && (
            <div className="mb-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20 flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 shadow-xl backdrop-blur-md">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-destructive/80">
                  {error.type === 'tool'
                    ? t('error.tool')
                    : error.type === 'system'
                      ? t('error.system')
                      : t('error.stream')}
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
                    {t('error.updateSettings')} →
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
            placeholder={
              compacting
                ? 'Compacting context...'
                : 'Type your message or use / for skills...'
            }
            onSend={onSend}
            loading={loading || compacting}
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
