import { MessageCircle, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ADD_ITEM_BUTTON } from '../../../lib/constants/renderer/styles'
import type { MessengerConfig } from '../../../lib/types/ai'
import { config, configMutations } from '../../bridge/config'
import { workspace } from '../../bridge/workspace'
import { Button } from '../../shared/basic/Button'
import { Section } from '../../shared/basic/Section'
import { MessengerCard } from '../../shared/featured/MessengerCard'
import { SettingsPage } from '../../shared/featured/SettingsPage'

interface MessengersTabProps {
  onRestore?: () => void
  t: (key: string) => string
}

export function MessengersTab({ onRestore, t }: MessengersTabProps) {
  const [messengers, setMessengers] = useState<MessengerConfig[]>([])
  const [workspaces, setWorkspaces] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([config.get('messengers'), workspace.list()]).then(
      ([resMessengers, wsConfig]: [any, any]) => {
        if (resMessengers) setMessengers(resMessengers)
        const wsList = wsConfig?.list || []
        setWorkspaces(wsList)
        setLoading(false)
      },
    )
  }, [])

  const saveMessengers = async (list: MessengerConfig[]) => {
    // Validate: no duplicate API keys
    const apiKeys = new Set<string>()
    for (const m of list) {
      if (m.apiKey && apiKeys.has(m.apiKey)) return
      if (m.apiKey) apiKeys.add(m.apiKey)
    }
    setMessengers(list)
    await configMutations.set('messengers', list)
  }

  const handleUpdate = (id: string, field: string, value: any) => {
    const list = messengers.map((m) =>
      m.id === id ? { ...m, [field]: value } : m,
    )
    saveMessengers(list)
  }

  const handleDelete = (id: string) => {
    saveMessengers(messengers.filter((m) => m.id !== id))
  }

  const handleAdd = () => {
    const id = `messenger-${Date.now()}`
    const newMessenger: MessengerConfig = {
      id,
      name: 'New Telegram Bot',
      type: 'telegram',
      apiKey: '',
      workspace: workspaces[0] || '',
      enabled: false,
      whitelist: [],
    }
    saveMessengers([...messengers, newMessenger])
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
              workspaces={workspaces}
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
