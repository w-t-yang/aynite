import { Info, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { DESCRIPTION_TEXT } from '../../../lib/constants/renderer/styles'
import type { MessengerConfig } from '../../../lib/types/ai'
import { Button } from '../basic/Button'
import { Input } from '../basic/Input'
import { Switch } from '../basic/Switch'
import { cn } from '../lib/utils'
import { DeleteItemModal } from './EditableCard'

const PROVIDER_OPTIONS = [
  { id: 'telegram', label: 'Telegram' },
  { id: 'discord', label: 'Discord' },
]

const PROVIDER_PLACEHOLDERS: Record<string, string> = {
  telegram: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
  discord: 'MTE4...',
}

interface MessengerCardProps {
  messenger: MessengerConfig
  onUpdate: (id: string, field: string, value: any) => void
  onDelete: (id: string) => void
}

export function MessengerCard({
  messenger,
  onUpdate,
  onDelete,
}: MessengerCardProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const isConfigured = messenger.apiKey.trim()

  const handleToggle = (enabled: boolean) => {
    if (enabled && !isConfigured) return // Cannot enable if not configured
    onUpdate(messenger.id, 'enabled', enabled)
  }

  return (
    <>
      <div
        className={cn(
          'p-5 rounded-xl border transition-all space-y-4',
          messenger.enabled
            ? 'border-primary bg-accent/5'
            : 'border-border bg-accent/5',
        )}
      >
        {/* Header: provider badge + delete */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/30 px-3 py-1 text-xs font-bold uppercase tracking-wider text-foreground">
              <span
                className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  messenger.provider === 'telegram'
                    ? 'bg-blue-400'
                    : 'bg-indigo-400',
                )}
              />
              {messenger.provider === 'telegram' ? 'Telegram' : 'Discord'}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowDeleteModal(true)}
            className="hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 size={16} />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Provider */}
          <div>
            <span className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Provider
            </span>
            <div className="flex gap-1.5">
              {PROVIDER_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onUpdate(messenger.id, 'provider', opt.id)}
                  className={cn(
                    'flex-1 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-all',
                    messenger.provider === opt.id
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-accent/30 text-muted-foreground hover:bg-accent/60',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* API Key */}
          <div>
            <Input
              label="API Key"
              type="password"
              value={messenger.apiKey}
              onChange={(e) => onUpdate(messenger.id, 'apiKey', e.target.value)}
              placeholder={PROVIDER_PLACEHOLDERS[messenger.provider] || ''}
            />
          </div>

          {/* Whitelist */}
          <div className="col-span-2">
            <label
              htmlFor={`whitelist-${messenger.id}`}
              className="text-xs font-medium text-muted-foreground mb-1.5 block"
            >
              Trusted Users
            </label>
            <textarea
              id={`whitelist-${messenger.id}`}
              value={messenger.whitelist?.join(', ') || ''}
              onChange={(e) =>
                onUpdate(
                  messenger.id,
                  'whitelist',
                  e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                )
              }
              placeholder="123456789, @username"
              rows={2}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm
                placeholder:text-muted-foreground/50 resize-none
                focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex items-start gap-1.5 mt-1">
              <Info
                size={12}
                className="mt-0.5 shrink-0 text-muted-foreground"
              />
              <span className="text-[11px] text-muted-foreground leading-tight">
                Only these user IDs or @usernames can interact with the bot. If
                empty, no one can talk to the bot.
              </span>
            </div>
          </div>

          {/* Toggle */}
          <div className="col-span-2 flex items-center gap-3 pt-1">
            <Switch
              checked={messenger.enabled}
              onCheckedChange={handleToggle}
            />
            <span className="text-xs font-medium text-muted-foreground">
              {messenger.enabled
                ? 'Enabled'
                : !isConfigured
                  ? 'Complete the API key to enable'
                  : 'Disabled'}
            </span>
          </div>
        </div>
      </div>

      <DeleteItemModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onDelete={() => onDelete(messenger.id)}
        title="Delete Messenger"
        itemName={messenger.provider}
        deleteLabel="Delete Messenger"
      >
        <p className={DESCRIPTION_TEXT}>
          This action will permanently remove this messenger configuration.
        </p>
      </DeleteItemModal>
    </>
  )
}
