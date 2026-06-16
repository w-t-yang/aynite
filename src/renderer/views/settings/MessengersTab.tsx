import { MessageCircle, Plus } from 'lucide-react'
import { ADD_ITEM_BUTTON } from '../../../lib/constants/renderer/styles'
import type { MessengerConfig } from '../../../lib/types/ai'
import { Button } from '../../shared/basic/Button'
import { Section } from '../../shared/basic/Section'
import { MessengerCard } from '../../shared/featured/MessengerCard'
import { SettingsPage } from '../../shared/featured/SettingsPage'

interface MessengersTabProps {
  state: {
    messengers: MessengerConfig[]
    workspaces: string[]
  }
  actions: {
    setMessengers: (messengers: MessengerConfig[]) => void
    onRestore?: () => void
    t: (key: string) => string
  }
}

export function MessengersTab({ state, actions }: MessengersTabProps) {
  const { messengers, workspaces } = state
  const { setMessengers, t } = actions

  const handleUpdate = (id: string, field: string, value: any) => {
    const list = messengers.map((m) =>
      m.id === id ? { ...m, [field]: value } : m,
    )
    setMessengers(list)
  }

  const handleDelete = (id: string) => {
    const list = messengers.filter((m) => m.id !== id)
    setMessengers(list)
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
    }
    setMessengers([...messengers, newMessenger])
  }

  return (
    <SettingsPage
      title={t('messengers.title')}
      description={t('messengers.description')}
      onRestore={actions.onRestore}
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
