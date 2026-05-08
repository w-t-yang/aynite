import { Bot, Terminal, Zap } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import type { StreamPart } from '../../../../lib/types/chat'

interface StreamingIndicatorProps {
  step: StreamPart | null
}

export function StreamingIndicator({ step }: StreamingIndicatorProps) {
  if (!step) return null

  let label = 'Working...'
  let Icon = Bot
  let colorClass = 'text-primary/60'

  switch (step.type) {
    case 'text-delta':
      label = 'Responding...'
      Icon = Bot
      break
    case 'reasoning-delta':
      label = 'Thinking...'
      Icon = Zap
      colorClass = 'text-amber-500/60'
      break
    case 'tool-call':
      label = `Calling ${step.toolName}...`
      Icon = Terminal
      colorClass = 'text-blue-500/60'
      break
    case 'tool-result':
      label = `Processing ${step.toolName}...`
      Icon = Terminal
      colorClass = 'text-green-500/60'
      break
    case 'error':
      label = 'Error'
      colorClass = 'text-destructive/60'
      break
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-2">
      <AnimatePresence mode="wait">
        <motion.div
          key={label}
          initial={{ opacity: 0, x: -5 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 5 }}
          className={`flex items-center gap-2.5 ${colorClass}`}
        >
          <Icon size={14} className="animate-pulse" />
          <span className="text-[11px] font-bold uppercase tracking-[0.15em] opacity-80">
            {label}
          </span>
          <div className="flex gap-1 ml-1 opacity-40">
            <div className="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
            <div className="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
            <div className="w-1 h-1 rounded-full bg-current animate-bounce" />
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
