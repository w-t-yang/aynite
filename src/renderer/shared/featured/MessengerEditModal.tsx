/**
 * MessengerEditModal — single modal for creating or editing a messenger bot config.
 *
 * Used by both:
 * - HomeView (for creating new / editing bound bots)
 * - AgentSettingsTab (for editing bound bots)
 *
 * The modal handles:
 * - Provider selection (Telegram / Discord)
 * - API key input
 * - Whitelist (trusted users)
 * - Project folder dropdown
 * - Test connectivity button — replaces the save button entirely.
 *   User must test first. If test succeeds, button shows "Save".
 *   If test fails, button shows "Test Connection" again.
 * - Save: creates if no config ID, updates if existing.
 *   Always saved as enabled (no enable toggle).
 */

import { CheckCircle2, ExternalLink, XCircle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { MessengerConfig } from '../../../lib/types/ai'
import { config, configMutations } from '../../bridge/config'
import { messenger } from '../../bridge/messenger'
import { systemMutations } from '../../bridge/system'
import { workspace } from '../../bridge/workspace'
import { Button } from '../basic/Button'
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

const PROVIDER_PLACEHOLDERS: Record<string, string> = {
  telegram: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
  discord: 'MTE4...',
}

interface MessengerEditModalProps {
  isOpen: boolean
  onClose: () => void
  /** If provided, we're editing an existing config. If null, creating a new one. */
  existing?: MessengerConfig | null
  /** The agent ID to bind this messenger to (set when opening the modal). */
  agentId: string
}

export function MessengerEditModal({
  isOpen,
  onClose,
  existing,
  agentId,
}: MessengerEditModalProps) {
  // ── Form state ──────────────────────────────────────────────────────
  const [provider, setProvider] = useState<'telegram' | 'discord'>('telegram')
  const [apiKey, setApiKey] = useState('')
  const [whitelist, setWhitelist] = useState('')
  const [projectFolder, setProjectFolder] = useState('')
  const [projectFolders, setProjectFolders] = useState<string[]>([])

  // ── Test / Save state ───────────────────────────────────────────────
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    botName?: string
    error?: string
  } | null>(null)
  const [saving, setSaving] = useState(false)

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setProvider(existing?.provider || 'telegram')
      setApiKey(existing?.apiKey || '')
      setWhitelist(existing?.whitelist?.join(', ') || '')
      setProjectFolder(existing?.projectFolder || '')
      setTestResult(null)
      setTesting(false)
      setSaving(false)

      // Load project folders
      workspace.folders().then((f: string[]) => {
        setProjectFolders(f || [])
      })
    }
  }, [isOpen, existing])

  const hasApiKey = apiKey.trim().length > 0
  const canSave = testResult?.success === true && hasApiKey

  const handleTest = useCallback(async () => {
    if (!hasApiKey) return
    setTesting(true)
    setTestResult(null)
    try {
      const result = await messenger.test(provider, apiKey.trim())
      setTestResult(result as any)
    } catch (err) {
      setTestResult({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setTesting(false)
    }
  }, [provider, apiKey, hasApiKey])

  const handleSave = useCallback(async () => {
    if (!canSave) return
    setSaving(true)
    try {
      const parsedWhitelist = whitelist
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      const newConfig: MessengerConfig = {
        id: existing?.id || `messenger-${Date.now()}`,
        provider,
        apiKey: apiKey.trim(),
        enabled: true, // Always saved as enabled
        whitelist: parsedWhitelist,
        contextSize: existing?.contextSize || 100,
        agentId,
        projectFolder: projectFolder || undefined,
        connected: true,
        lastError: undefined,
        botName: testResult?.botName || existing?.botName,
      }

      const allConfigs = ((await config.get('messengers')) ||
        []) as MessengerConfig[]
      const idx = allConfigs.findIndex((m) => m.id === newConfig.id)
      let updated: MessengerConfig[]
      if (idx >= 0) {
        updated = [...allConfigs]
        updated[idx] = newConfig
      } else {
        updated = [...allConfigs, newConfig]
      }

      await configMutations.set('messengers', updated)
      onClose()
    } catch (err) {
      setTestResult({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to save',
      })
    } finally {
      setSaving(false)
    }
  }, [
    existing,
    provider,
    apiKey,
    whitelist,
    agentId,
    projectFolder,
    testResult,
    onClose,
    canSave,
  ])

  const handleOpenGuide = useCallback(() => {
    systemMutations.openExternal(GUIDE_URL)
  }, [])

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        isOpen
          ? `${existing ? 'Edit' : 'Connect'} ${provider === 'telegram' ? 'Telegram' : 'Discord'} Bot`
          : ''
      }
      size="sm"
      footer={
        canSave ? (
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={handleTest}
            disabled={!hasApiKey || testing}
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </Button>
        )
      }
    >
      <div className="space-y-4">
        {/* Provider selection */}
        <div>
          <span className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Provider
          </span>
          <div className="flex gap-1.5">
            {PROVIDER_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setProvider(opt.id)
                  setTestResult(null)
                }}
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
        </div>

        {/* API Key */}
        <div>
          <label
            htmlFor="edit-api-key"
            className="text-xs font-medium text-muted-foreground mb-1.5 block"
          >
            API Key
          </label>
          <input
            id="edit-api-key"
            type="password"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value)
              setTestResult(null)
            }}
            placeholder={PROVIDER_PLACEHOLDERS[provider] || ''}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm
              focus:outline-none focus:ring-1 focus:ring-primary
              placeholder:text-muted-foreground/50"
          />
        </div>

        {/* Whitelist */}
        <div>
          <label
            htmlFor="edit-whitelist"
            className="text-xs font-medium text-muted-foreground mb-1.5 block"
          >
            Trusted Users (optional)
          </label>
          <textarea
            id="edit-whitelist"
            value={whitelist}
            onChange={(e) => setWhitelist(e.target.value)}
            placeholder="123456789, @username"
            rows={2}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm
              placeholder:text-muted-foreground/50 resize-none
              focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <p className="text-[10px] text-muted-foreground/50 mt-1">
            Comma-separated user IDs or @usernames. If empty, no one can use the
            bot.
          </p>
        </div>

        {/* Project Folder */}
        <div>
          <label
            htmlFor="edit-project-folder"
            className="text-xs font-medium text-muted-foreground mb-1.5 block"
          >
            Project Folder (optional)
          </label>
          <select
            id="edit-project-folder"
            value={projectFolder}
            onChange={(e) => setProjectFolder(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm
              focus:outline-none focus:ring-1 focus:ring-primary truncate"
          >
            <option value="">Not set</option>
            {projectFolders.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        {/* Test result */}
        {testResult && (
          <div
            className={cn(
              'flex items-start gap-2 rounded-lg p-3 text-xs',
              testResult.success
                ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                : 'bg-red-500/10 text-red-600 dark:text-red-400',
            )}
          >
            {testResult.success ? (
              <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
            ) : (
              <XCircle size={14} className="mt-0.5 shrink-0" />
            )}
            <div>
              {testResult.success
                ? testResult.botName
                  ? `Connected as ${testResult.botName}`
                  : 'Connected successfully'
                : testResult.error || 'Connection failed'}
              {!testResult.success && (
                <div className="mt-1">
                  <button
                    type="button"
                    onClick={handleOpenGuide}
                    className="inline-flex items-center gap-1 text-[10px] font-medium text-primary/70 hover:text-primary bg-transparent border-none p-0 cursor-pointer"
                  >
                    <ExternalLink size={10} />
                    Setup Guide
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Guide link */}
        <div className="border-t border-border/40 pt-3">
          <button
            type="button"
            onClick={handleOpenGuide}
            className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors bg-transparent border-none p-0 cursor-pointer"
          >
            <ExternalLink size={11} />
            How to create a bot? (Setup Guide)
          </button>
        </div>
      </div>
    </Modal>
  )
}
