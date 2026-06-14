import { Code, Files, Layout, MessageSquare } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../shared/basic/Button'
import { Modal } from '../../shared/basic/Modal'
import { useI18n } from '../../shared/i18n/useI18n'
import { cn } from '../../shared/lib/utils'
import { useApp } from '../AppContext'
import { getVibeLayout, type VibeType } from '../utils/vibe'

interface LayoutVibeModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (name: string, layout: any) => void
}

const VIBES = [
  {
    id: 'chat' as VibeType,
    labelKey: 'vibe.chatLabel',
    descKey: 'vibe.chatDesc',
    icon: <MessageSquare className="text-blue-500" size={24} />,
    color: 'bg-blue-500/10 border-blue-500/20 hover:border-blue-500/50',
  },
  {
    id: 'file' as VibeType,
    labelKey: 'vibe.fileLabel',
    descKey: 'vibe.fileDesc',
    icon: <Files className="text-emerald-500" size={24} />,
    color:
      'bg-emerald-500/10 border-emerald-500/20 hover:border-emerald-500/50',
  },
  {
    id: 'code' as VibeType,
    labelKey: 'vibe.codeLabel',
    descKey: 'vibe.codeDesc',
    icon: <Code className="text-purple-500" size={24} />,
    color: 'bg-purple-500/10 border-purple-500/20 hover:border-purple-500/50',
  },
  {
    id: 'empty' as VibeType,
    labelKey: 'vibe.emptyLabel',
    descKey: 'vibe.emptyDesc',
    icon: <Layout className="text-neutral-500" size={24} />,
    color:
      'bg-neutral-500/10 border-neutral-500/20 hover:border-neutral-500/50',
  },
]

export function LayoutVibeModal({
  isOpen,
  onClose,
  onConfirm,
}: LayoutVibeModalProps) {
  const { locale } = useApp()
  const { t } = useI18n(locale)
  const [selected, setSelected] = useState<VibeType | null>(null)

  const handleConfirm = () => {
    if (!selected) return
    const vibe = VIBES.find((v) => v.id === selected)
    const layout = getVibeLayout(selected)
    onConfirm(t(vibe?.labelKey || 'vibe.chatLabel'), layout)
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('vibe.title')}
      size="2xl"
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t('vibe.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={!selected}
            onClick={handleConfirm}
          >
            {t('vibe.confirm')}
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        {VIBES.map((vibe) => (
          <Button
            key={vibe.id}
            variant="ghost"
            onClick={() => setSelected(vibe.id)}
            className={cn(
              'flex flex-col items-start p-5 rounded-xl border-2 transition-all text-left space-y-3 h-auto',
              vibe.color,
              selected === vibe.id
                ? 'ring-2 ring-primary ring-offset-2 border-primary hover:bg-opacity-100'
                : 'border-transparent',
            )}
          >
            <div className="p-2 rounded-lg bg-background/50 border border-border/50">
              {vibe.icon}
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-base">{t(vibe.labelKey)}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t(vibe.descKey)}
              </p>
            </div>
          </Button>
        ))}
      </div>
    </Modal>
  )
}
