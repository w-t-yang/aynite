import type { UIMessage } from 'ai'
import { forwardRef } from 'react'
import { FLEX_CENTER_GAP_3 } from '../../../../lib/constants/renderer/styles'
import { MessageItem } from './Message'

interface ListProps {
  messages: UIMessage[]
  loading: boolean
  onOpenFile: (path: string) => void
  onCopy: (content: string) => void
  onRevert: (index: number) => void
}

/**
 * Scrollable message list. Only renders messages — no indicators, no overlays.
 * Indicator row lives outside this component in AIChat.tsx so it stays fixed.
 */
export const List = forwardRef<HTMLDivElement, ListProps>(
  ({ messages, loading, onOpenFile, onCopy, onRevert }, ref) => {
    return (
      <div
        className="flex-1 overflow-y-auto mask-fade-vertical scrollbar-gutter-stable"
        ref={ref}
      >
        <div className="max-w-[900px] mx-auto">
          {messages.length === 0 && (
            <div className="text-muted-foreground flex flex-col items-start justify-center min-h-[400px] space-y-6 px-4">
              <div className="space-y-3 text-sm opacity-80">
                <p className={FLEX_CENTER_GAP_3}>
                  <span className="w-6 h-6 rounded bg-accent shrink-0 flex items-center justify-center text-xs font-mono font-bold">
                    Aa
                  </span>
                  Type any text to talk to AI
                </p>
                <p className={FLEX_CENTER_GAP_3}>
                  <span className="w-6 h-6 rounded bg-accent shrink-0 flex items-center justify-center text-xs font-mono font-bold">
                    /
                  </span>
                  Use <code className="text-primary font-bold">/skill</code> to
                  mention AI skills
                </p>
                <p className={FLEX_CENTER_GAP_3}>
                  <span className="w-6 h-6 rounded bg-accent shrink-0 flex items-center justify-center text-xs font-mono font-bold">
                    @
                  </span>
                  Use <code className="text-primary font-bold">@file</code> to
                  reference files
                </p>
                <p className={FLEX_CENTER_GAP_3}>
                  <span className="w-6 h-6 rounded bg-accent shrink-0 flex items-center justify-center text-xs font-mono font-bold">
                    &gt;
                  </span>
                  Use <code className="text-primary font-bold">&gt;cmd</code> to
                  run custom commands
                </p>
              </div>
            </div>
          )}

          {messages.map((m, idx) => (
            <MessageItem
              key={m.id || idx}
              msg={m}
              idx={idx}
              total={messages.length}
              isStreaming={loading && idx === messages.length - 1}
              onOpenFile={onOpenFile}
              onCopy={onCopy}
              onRevert={() => onRevert(idx)}
            />
          ))}
        </div>
      </div>
    )
  },
)

List.displayName = 'List'
