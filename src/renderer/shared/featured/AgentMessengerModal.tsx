/**
 * AgentMessengerModal — modal for binding a messenger bot to an agent.
 *
 * Shows existing configured bots for selection, or allows the user to
 * create a new bot directly from the agent's page.
 */

import { ExternalLink } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { Agent, MessengerConfig } from '../../../lib/types/ai'
import { config, configMutations } from '../../bridge/config'
import { systemMutations } from '../../bridge/system'
import { Button } from '../basic/Button'
import { Input } from '../basic/Input'
import { Modal } from '../basic/Modal'
import { cn } from '../lib/utils'

const GUIDE_URL =
  'https://github.com/w-t-yang/aynite/blob/master/docs/guides/MESSENGER_BOTS.md'

const PROVIDER_OPTIONS: Array<{
  id: 'telegram' | 'discord'
  label: string
  recommended?: boolean
}> = [
  { id: 'telegram', label: 'Telegram', recommended: true },
  { id: 'discord', label: 'Discord' },
]

interface AgentMessengerModalProps {
  isOpen: boolean
  onClose: () => void
  agent: Agent
}

export function AgentMessengerModal({
  isOpen,
  onClose,
  agent,
}: AgentMessengerModalProps) {
  const [existingBots, setExistingBots] = useState<MessengerConfig[]>([])
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null)
  const [provider, setProvider] = useState<'telegram' | 'discord'>('telegram')
  const [apiKey, setApiKey] = useState('')
  const [whitelist, setWhitelist] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createMode, setCreateMode] = useState(false)

  const loadData = useCallback(async () => {
    const messengers = (await config.get('messengers')) as
      | MessengerConfig[]
      | null
    setExistingBots(messengers || [])
    setSelectedBotId(null)
    setProvider('telegram')
    setApiKey('')
    setWhitelist('')
    setSaving(false)
    setError(null)
    setCreateMode(false)
  }, [])

  useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen, loadData])

  // Check if the messenger is "properly configured" (has API key + enabled)
  const isConfigValid = (m: MessengerConfig): boolean => {
    return m.apiKey.trim().length > 0 && m.enabled
  }

  const isCreateValid = apiKey.trim().length > 0

  const getDefaultProjectFolder = (): string | undefined => {
    if (agent.id === 'assistant') return '~/.aynite/assistant/'
    return undefined
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      if (createMode) {
        const newId = `messenger-${Date.now()}`
        const newMessenger: MessengerConfig = {
          id: newId,
          provider,
          apiKey: apiKey.trim(),
          enabled: isCreateValid,
          whitelist: whitelist
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          contextSize: 100,
          agentId: agent.id,
          projectFolder: getDefaultProjectFolder(),
        }
        const all = [...existingBots, newMessenger]
        await configMutations.set('messengers', all)
      } else {
        const updated = existingBots.map((m) =>
          m.id === selectedBotId ? { ...m, agentId: agent.id } : m,
        )
        await configMutations.set('messengers', updated)
      }
      onClose()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save messenger config',
      )
    } finally {
      setSaving(false)
    }
  }

  const handleOpenGuide = () => {
    systemMutations.openExternal(GUIDE_URL)
  }

  const availableBots = existingBots.filter(
    (m) => !m.agentId || m.agentId === agent.id,
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Connect ${agent.name} to a Messenger Bot`}
      size="md"
    >
      <div className="space-y-6">
        <button
          type="button"
          onClick={handleOpenGuide}
          className="flex items-center gap-2 text-xs text-primary/70 hover:text-primary transition-colors bg-transparent border-none p-0 cursor-pointer"
        >
          <ExternalLink size={12} />
          How to create a bot? (Setup Guide)
        </button>

        {availableBots.length > 0 && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCreateMode(false)}
              className={cn(
                'flex-1 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-all',
                !createMode
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-accent/30 text-muted-foreground hover:bg-accent/60',
              )}
            >
              Select existing bot
            </button>
            <button
              type="button"
              onClick={() => setCreateMode(true)}
              className={cn(
                'flex-1 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-all',
                createMode
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-accent/30 text-muted-foreground hover:bg-accent/60',
              )}
            >
              Create new bot
            </button>
          </div>
        )}

        {createMode ? (
          <div className="space-y-4">
            <div>
              <span className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Provider
              </span>
              <div className="flex gap-1.5">
                {PROVIDER_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setProvider(opt.id)}
                    className={cn(
                      'flex-1 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5',
                      provider === opt.id
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-accent/30 text-muted-foreground hover:bg-accent/60',
                    )}
                  >
                    {opt.label}
                    {opt.recommended && (
                      <span className="text-[9px] opacity-70">★</span>
                    )}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground/50 mt-1">
                {provider === 'telegram'
                  ? 'Recommended. Easy to set up and free.'
                  : 'Requires a Discord application and privileged intents.'}
              </p>
            </div>

            <Input
              label="API Key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                provider === 'telegram'
                  ? '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11'
                  : 'MTE4...'
              }
            />

            <div>
              <label
                htmlFor="modal-whitelist"
                className="text-xs font-medium text-muted-foreground mb-1.5 block"
              >
                Trusted Users (optional)
              </label>
              <textarea
                id="modal-whitelist"
                value={whitelist}
                onChange={(e) => setWhitelist(e.target.value)}
                placeholder="123456789, @username"
                rows={2}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm
                  placeholder:text-muted-foreground/50 resize-none
                  focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="text-[10px] text-muted-foreground/50 mt-1">
                Comma-separated user IDs or @usernames. If empty, no one can use
                the bot until you configure it.
              </p>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        ) : (
          <div className="space-y-3">
            {availableBots.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedBotId(m.id)}
                className={cn(
                  'w-full text-left p-4 rounded-xl border transition-all',
                  selectedBotId === m.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-accent/5 hover:border-border/60',
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                        m.provider === 'telegram'
                          ? 'bg-blue-400/10 text-blue-400'
                          : 'bg-indigo-400/10 text-indigo-400',
                      )}
                    >
                      <span
                        className={cn(
                          'w-1.5 h-1.5 rounded-full',
                          m.provider === 'telegram'
                            ? 'bg-blue-400'
                            : 'bg-indigo-400',
                        )}
                      />
                      {m.provider}
                    </span>
                    {m.botName && (
                      <span className="text-xs text-muted-foreground">
                        {m.botName}
                      </span>
                    )}
                  </div>
                  {m.enabled && (
                    <span className="text-[10px] text-green-500 font-medium">
                      Connected
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>
                    {m.whitelist?.length
                      ? `${m.whitelist.length} trusted user(s)`
                      : 'No whitelist configured'}
                  </span>
                  {!isConfigValid(m) && (
                    <span className="text-amber-500">Not configured</span>
                  )}
                </div>
              </button>
            ))}
            {availableBots.length === 0 && (
              <p className="text-sm text-muted-foreground/50 text-center py-4">
                No unbound bots available. Create a new one instead.
              </p>
            )}
          </div>
        )}

        <div className="border-t border-border/40 pt-4">
          <button
            type="button"
            onClick={handleOpenGuide}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors bg-transparent border-none p-0 cursor-pointer"
          >
            <ExternalLink size={11} />
            Read the setup guide for detailed instructions
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between w-full">
        <p className="text-[10px] text-muted-foreground/50">
          {createMode
            ? 'The messenger will be created and enabled'
            : 'The selected messenger will be bound to this agent'}
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || (createMode ? !isCreateValid : !selectedBotId)}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
