import { ArrowRight, Wrench } from 'lucide-react'
import { useEffect, useState } from 'react'
import { GRID_2_COL } from '../../../lib/constants/renderer/styles'
import { config } from '../../bridge/config'
import { Section } from '../../shared/basic/Section'
import { SettingsPage } from '../../shared/featured/SettingsPage'

interface ToolsTabProps {
  onRestore?: () => void
  t: (key: string) => string
}

export function ToolsTab({ onRestore, t }: ToolsTabProps) {
  const [availableTools, setAvailableTools] = useState<
    { id: string; name: string; description: string }[]
  >([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    config.get('tools').then((resTools: any) => {
      if (resTools) {
        setAvailableTools(resTools.list || [])
      }
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <SettingsPage
        title={t('tools.title')}
        description={t('tools.description')}
      >
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
          Loading...
        </div>
      </SettingsPage>
    )
  }

  return (
    <SettingsPage
      title={t('tools.title')}
      description={t('tools.description')}
      onRestore={onRestore}
    >
      {/* Notice */}
      <div className="mb-6 p-4 rounded-xl border border-primary/20 bg-primary/5">
        <div className="flex items-start gap-3">
          <Wrench size={16} className="text-primary shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-1">
              Tools are now per-agent
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Tool configuration has moved to the <strong>Agents</strong>{' '}
              settings tab. Each agent has its own set of toggleable tools.
              Click the Agents tab in the sidebar to configure tools for each
              agent individually.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline cursor-pointer bg-transparent border-none p-0"
                onClick={() => {
                  window.location.hash = '#tab=agents'
                  window.location.reload()
                }}
              >
                Go to Agents <ArrowRight size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tool Reference — read-only list of available tools */}
      <Section
        title={t('tools.capabilities')}
        description="This is a reference list of all available system tools."
      >
        <div className={GRID_2_COL}>
          {availableTools.map((tool) => (
            <div
              key={tool.id}
              className="flex items-center justify-between p-4 rounded-xl border border-border/40 bg-accent/5"
            >
              <div className="space-y-1 flex-1 min-w-0 pr-6">
                <h4 className="text-sm font-bold uppercase tracking-wider">
                  {tool.name}
                </h4>
                <p className="text-[11px] text-muted-foreground/70 leading-relaxed line-clamp-2">
                  {tool.description}
                </p>
              </div>
            </div>
          ))}
          {availableTools.length === 0 && (
            <div className="col-span-full py-12 text-center text-sm text-muted-foreground italic border border-dashed border-border rounded-xl opacity-50">
              {t('tools.noTools')}
            </div>
          )}
        </div>
      </Section>
    </SettingsPage>
  )
}
