import { Code, Files, MessageSquare, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../shared/basic/Button'
import { Modal } from '../../shared/basic/Modal'
import { cn } from '../../shared/lib/utils'
import { getVibeLayout, type VibeType } from '../utils/vibe'

interface LayoutVibeModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (name: string, layout: any) => void
}

const VIBES = [
  {
    id: 'chat' as VibeType,
    label: 'Chat Vibe',
    description:
      'Perfect for focused AI interaction with Session View and Chat.',
    icon: <MessageSquare className="text-blue-500" size={24} />,
    color: 'bg-blue-500/10 border-blue-500/20 hover:border-blue-500/50',
  },
  {
    id: 'file' as VibeType,
    label: 'File Vibe',
    description:
      'A traditional file management setup with Treeview and Explorer.',
    icon: <Files className="text-emerald-500" size={24} />,
    color:
      'bg-emerald-500/10 border-emerald-500/20 hover:border-emerald-500/50',
  },
  {
    id: 'code' as VibeType,
    label: 'Code Vibe',
    description: 'The ultimate dev environment: Treeview, Files, and AI Chat.',
    icon: <Code className="text-purple-500" size={24} />,
    color: 'bg-purple-500/10 border-purple-500/20 hover:border-purple-500/50',
  },
  {
    id: 'surprise' as VibeType,
    label: 'Surprise Me',
    description: 'Start with a blank canvas and build your own unique vibe.',
    icon: <Sparkles className="text-amber-500" size={24} />,
    color: 'bg-amber-500/10 border-amber-500/20 hover:border-amber-500/50',
  },
]

export function LayoutVibeModal({
  isOpen,
  onClose,
  onConfirm,
}: LayoutVibeModalProps) {
  const [selected, setSelected] = useState<VibeType | null>(null)

  const handleConfirm = () => {
    if (!selected) return
    const vibe = VIBES.find((v) => v.id === selected)
    const layout = getVibeLayout(selected)
    onConfirm(vibe?.label || 'New Layout', layout)
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="How would you like your new vibe?"
      size="2xl"
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!selected}
            onClick={handleConfirm}
          >
            Confirm Vibe
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        {VIBES.map((vibe) => (
          <button
            key={vibe.id}
            type="button"
            onClick={() => setSelected(vibe.id)}
            className={cn(
              'flex flex-col items-start p-5 rounded-xl border-2 transition-all text-left space-y-3',
              vibe.color,
              selected === vibe.id
                ? 'ring-2 ring-primary ring-offset-2 border-primary'
                : 'border-transparent',
            )}
          >
            <div className="p-2 rounded-lg bg-background/50 border border-border/50">
              {vibe.icon}
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-base">{vibe.label}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {vibe.description}
              </p>
            </div>
          </button>
        ))}
      </div>
    </Modal>
  )
}
