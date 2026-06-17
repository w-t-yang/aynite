import { useEffect, useState } from 'react'
import { AppOperation } from '../../../lib/constants/app'
import { config, configMutations } from '../../bridge/config'
import { Section } from '../../shared/basic/Section'
import { KeybindingRow } from '../../shared/featured/KeybindingRow'
import { SettingsPage } from '../../shared/featured/SettingsPage'
import type { Keybinding, SettingsState } from '../../shared/lib/types'

interface KeybindingsTabProps {
  onRestore?: () => void
  t: (key: string) => string
}

export function KeybindingsTab({ onRestore, t }: KeybindingsTabProps) {
  const [keybindings, setKeybindings] = useState<SettingsState['keybindings']>({
    app: {},
    view: {},
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    config.get('keybindings').then((resKb: any) => {
      if (resKb) setKeybindings(resKb as SettingsState['keybindings'])
      setLoading(false)
    })
  }, [])

  const persistKeybindings = async (kb: SettingsState['keybindings']) => {
    setKeybindings(kb)
    await configMutations.set('keybindings', { list: kb } as any)
  }

  const formatKeybinding = (kb?: Keybinding): string => {
    if (!kb) return ''
    const parts = []
    if (kb.ctrl) parts.push('Ctrl')
    if (kb.meta) parts.push('Cmd')
    if (kb.alt) parts.push('Alt')
    if (kb.shift) parts.push('Shift')
    if (kb.key) parts.push(kb.key.toUpperCase())
    return parts.join('+')
  }

  const parseKeybinding = (value: string): Keybinding => {
    const parts = value.split('+')
    const key = parts.pop()?.toLowerCase() || ''
    return {
      ctrl: parts.includes('Ctrl'),
      meta: parts.includes('Cmd'),
      alt: parts.includes('Alt'),
      shift: parts.includes('Shift'),
      key,
    }
  }

  const handleKeybindingChange = (
    group: 'app' | 'view',
    type: string,
    value: string,
  ) => {
    const newKeybindings = { ...keybindings }
    newKeybindings[group] = {
      ...newKeybindings[group],
      [type]: parseKeybinding(value),
    }
    persistKeybindings(newKeybindings)
  }

  if (loading) {
    return (
      <SettingsPage
        title={t('keybindings.title')}
        description={t('keybindings.description')}
      >
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
          Loading...
        </div>
      </SettingsPage>
    )
  }

  return (
    <SettingsPage
      title={t('keybindings.title')}
      description={t('keybindings.description')}
      onRestore={onRestore}
    >
      <Section
        title={t('keybindings.application.title')}
        description={t('keybindings.application.description')}
      >
        <div className="grid grid-cols-2 gap-x-12 gap-y-1">
          <KeybindingRow
            label={t('keybindings.cycleTile')}
            value={formatKeybinding(keybindings.app[AppOperation.TILE_CYCLE])}
            onChange={(v) =>
              handleKeybindingChange('app', AppOperation.TILE_CYCLE, v)
            }
          />
          <KeybindingRow
            label={t('keybindings.splitVertical')}
            value={formatKeybinding(
              keybindings.app[AppOperation.TILE_SPLIT_VERTICAL],
            )}
            onChange={(v) =>
              handleKeybindingChange('app', AppOperation.TILE_SPLIT_VERTICAL, v)
            }
          />
          <KeybindingRow
            label={t('keybindings.splitHorizontal')}
            value={formatKeybinding(
              keybindings.app[AppOperation.TILE_SPLIT_HORIZONTAL],
            )}
            onChange={(v) =>
              handleKeybindingChange(
                'app',
                AppOperation.TILE_SPLIT_HORIZONTAL,
                v,
              )
            }
          />
          <KeybindingRow
            label={t('keybindings.closeTile')}
            value={formatKeybinding(keybindings.app[AppOperation.TILE_CLOSE])}
            onChange={(v) =>
              handleKeybindingChange('app', AppOperation.TILE_CLOSE, v)
            }
          />
          <KeybindingRow
            label={t('keybindings.refreshTile')}
            value={formatKeybinding(keybindings.app[AppOperation.REFRESH_TILE])}
            onChange={(v) =>
              handleKeybindingChange('app', AppOperation.REFRESH_TILE, v)
            }
          />
        </div>
      </Section>
    </SettingsPage>
  )
}
