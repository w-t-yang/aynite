import { MessageCircle, Plus } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ADD_ITEM_BUTTON } from '../../../lib/constants/renderer/styles'
import type { Agent, MessengerConfig } from '../../../lib/types/ai'

import { config, configMutations } from '../../bridge/config'
import { logger } from '../../bridge/logger'
import { Button } from '../../shared/basic/Button'
import { Section } from '../../shared/basic/Section'
import { MessengerCard } from '../../shared/featured/MessengerCard'
import { SettingsPage } from '../../shared/featured/SettingsPage'
import { useViewEvent } from '../useViewEvents'

interface MessengersTabProps {
  onRestore?: () => void
  t: (key: string) => string
}

export function MessengersTab({ onRestore, t }: MessengersTabProps) {
  const [messengers, setMessengers] = useState<MessengerConfig[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [projectFolders, setProjectFolders] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    const [resMessengers, resAgents, resWorkspaces] = (await Promise.all([
      config.get('messengers'),
      config.get('agents'),
      config.get('workspaces'),
    ])) as [MessengerConfig[] | null, any, any]

    if (resMessengers) setMessengers(resMessengers)
    if (resAgents?.list) setAgents(resAgents.list as Agent[])

    // Collect unique project folders from all workspaces.
    if (Array.isArray(resWorkspaces)) {
      const unique = new Set<string>()
      for (const ws of resWorkspaces as Array<{ folders?: string[] }>) {
        if (ws.folders) {
          for (const f of ws.folders) unique.add(f)
        }
      }
      setProjectFolders(Array.from(unique))
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Listen for config changes (bot name updates, etc.)
  useViewEvent('config-changed', (data: any) => {
    if (data?.key === 'messengers') {
      loadData()
    }
  })

  // Track the latest list to save — used by the debounced saver
  const pendingListRef = useRef<MessengerConfig[] | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flushSave = useCallback(async () => {
    const list = pendingListRef.current
    if (!list) return
    pendingListRef.current = null

    logger.log(
      '[MessengersTab] flushSave: list=',
      list.map((m) => ({
        id: m.id,
        whitelist: m.whitelist,
        botName: m.botName,
      })),
    )

    // Validate: no duplicate API keys (skip empty/placeholder keys)
    const apiKeys = new Set<string>()
    for (const m of list) {
      if (!m.apiKey) continue
      if (apiKeys.has(m.apiKey)) {
        logger.log(
          '[MessengersTab] flushSave: DUPLICATE API KEY detected, returning early',
        )
        return
      }
      apiKeys.add(m.apiKey)
    }
    setMessengers(list)
    logger.log('[MessengersTab] flushSave: calling configMutations.set')
    await configMutations.set('messengers', list)
    logger.log('[MessengersTab] flushSave: done')
  }, [])

  // Debounced save — coalesces rapid updates into a single save
  const scheduleSave = useCallback(
    (list: MessengerConfig[]) => {
      pendingListRef.current = list
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        flushSave()
      }, 400)
    },
    [flushSave],
  )

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  const handleUpdate = (id: string, field: string, value: any) => {
    logger.log(
      `[MessengersTab] handleUpdate: id=${id} field=${field} value=`,
      value,
    )
    const list = messengers.map((m) =>
      m.id === id ? { ...m, [field]: value } : m,
    )
    scheduleSave(list)
  }

  const handleDelete = (id: string) => {
    const list = messengers.filter((m) => m.id !== id)
    // Delete needs to flush immediately (no debounce)
    pendingListRef.current = list
    flushSave()
  }

  const handleAdd = () => {
    const id = `messenger-${Date.now()}`
    const newMessenger: MessengerConfig = {
      id,
      provider: 'telegram',
      apiKey: '',
      enabled: false,
      whitelist: [],
      contextSize: 100,
      agentId: undefined,
      projectFolder: undefined,
    }
    const list = [...messengers, newMessenger]
    // Add needs to flush immediately too
    pendingListRef.current = list
    flushSave()
  }

  if (loading) {
    return (
      <SettingsPage
        title={t('messengers.title')}
        description={t('messengers.description')}
      >
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
          Loading...
        </div>
      </SettingsPage>
    )
  }

  return (
    <SettingsPage
      title={t('messengers.title')}
      description={t('messengers.description')}
      onRestore={onRestore}
    >
      <Section
        title={t('messengers.bots')}
        action={
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAdd}
            className={ADD_ITEM_BUTTON}
          >
            <Plus size={14} /> {t('messengers.addBot')}
          </Button>
        }
      >
        <div className="space-y-6">
          {messengers.map((m) => (
            <MessengerCard
              key={m.id}
              messenger={m}
              agents={agents}
              projectFolders={projectFolders}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
          {messengers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-border rounded-xl opacity-50">
              <MessageCircle size={48} className="mb-4 text-muted-foreground" />
              <p className="text-sm">{t('messengers.noBots')}</p>
            </div>
          )}
        </div>
      </Section>
    </SettingsPage>
  )
}
