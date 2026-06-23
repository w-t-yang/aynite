import { Plus, Workflow } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FlowDefinition } from '../../../lib/types/flows'
import { flows } from '../../bridge/flows'
import { Button } from '../../shared/basic/Button'
import { loadViewTranslations } from '../../shared/i18n/loadViewI18n'
import { useI18n } from '../../shared/i18n/useI18n'
import { cn } from '../../shared/lib/utils'
import { useView } from '../ViewContext'
import viewConfig from './config.json'

export function FlowsView() {
  const { locale } = useView()
  const customTranslations = useMemo(
    () => loadViewTranslations((viewConfig as any).i18n),
    [],
  )
  const { t } = useI18n(locale, customTranslations)

  const [allFlows, setAllFlows] = useState<FlowDefinition[]>([])
  const [activeTab, setActiveTab] = useState<string>('overview')
  const [editingFlow, setEditingFlow] = useState<FlowDefinition | null>(null)
  // Stable unique IDs for each step, so .map() doesn't use array index as key
  const [stepIds, setStepIds] = useState<string[]>([])
  const stepIdCounter = useRef(0)

  // Load flows on mount
  const loadFlows = useCallback(async () => {
    const list = await flows.list()
    setAllFlows(list)
  }, [])

  useEffect(() => {
    loadFlows()
  }, [loadFlows])

  // Handle creating a new flow
  const handleCreateFlow = useCallback(async () => {
    const newFlow = await flows.create()
    setAllFlows((prev) => [newFlow, ...prev])
    setActiveTab(newFlow.id)
    setEditingFlow(newFlow)
  }, [])

  // Handle selecting a flow from the sidebar
  const handleSelectFlow = useCallback((flow: FlowDefinition) => {
    setActiveTab(flow.id)
    setEditingFlow({ ...flow })
    setStepIds(flow.steps.map(() => `s-${stepIdCounter.current++}`))
  }, [])

  // Handle saving flow changes
  const handleSaveFlow = useCallback(async () => {
    if (!editingFlow) return
    const updated = await flows.update(editingFlow.id, {
      name: editingFlow.name,
      description: editingFlow.description,
      steps: editingFlow.steps,
    })
    setAllFlows((prev) => prev.map((f) => (f.id === updated.id ? updated : f)))
    setEditingFlow(updated)
  }, [editingFlow])

  // Handle adding a step
  const handleAddStep = useCallback(() => {
    if (!editingFlow) return
    setEditingFlow({
      ...editingFlow,
      steps: [...editingFlow.steps, { userInstruction: '' }],
    })
    setStepIds((prev) => [...prev, `s-${stepIdCounter.current++}`])
  }, [editingFlow])

  // Handle step instruction change
  const handleStepChange = useCallback(
    (index: number, value: string) => {
      if (!editingFlow) return
      const newSteps = [...editingFlow.steps]
      newSteps[index] = { ...newSteps[index], userInstruction: value }
      setEditingFlow({ ...editingFlow, steps: newSteps })
    },
    [editingFlow],
  )

  // Handle name change
  const handleNameChange = useCallback((name: string) => {
    setEditingFlow((prev) => (prev ? { ...prev, name } : null))
  }, [])

  // Handle description change
  const handleDescriptionChange = useCallback((description: string) => {
    setEditingFlow((prev) => (prev ? { ...prev, description } : null))
  }, [])

  // Render tab content
  const renderTab = () => {
    if (activeTab === 'overview') {
      return (
        <div className="p-8 max-w-[640px] mx-auto w-full space-y-8">
          <div className="text-center pt-12 space-y-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mx-auto">
              <Workflow size={28} className="text-primary/60" />
            </div>
            <h2 className="text-xl font-bold text-foreground">
              {t('overviewTitle')}
            </h2>
            <p className="text-sm text-muted-foreground/60 max-w-sm mx-auto leading-relaxed">
              {t('overviewDesc')}
            </p>
          </div>

          <div className="flex justify-center pt-4">
            <Button variant="primary" onClick={handleCreateFlow}>
              <Plus size={14} /> {t('addFlowBtn')}
            </Button>
          </div>

          {allFlows.length > 0 && (
            <div className="space-y-3 pt-8 border-t border-border">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/40">
                {t('recentFlows')}
              </p>
              <div className="space-y-1">
                {allFlows.slice(0, 5).map((flow) => (
                  <button
                    key={flow.id}
                    type="button"
                    onClick={() => handleSelectFlow(flow)}
                    className="w-full text-left px-4 py-3 rounded-lg border border-border bg-accent/5 hover:bg-accent/10 transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <Workflow
                        size={14}
                        className="shrink-0 text-muted-foreground/40"
                      />
                      <span className="text-sm font-medium text-foreground">
                        {flow.name}
                      </span>
                      {flow.steps.length > 0 && (
                        <span className="text-[10px] text-muted-foreground/30">
                          {flow.steps.length} step
                          {flow.steps.length === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                    {flow.description && (
                      <p className="text-[11px] text-muted-foreground/50 mt-1 truncate">
                        {flow.description}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )
    }

    // Flow detail view
    if (editingFlow) {
      return (
        <div className="p-8 max-w-[640px] mx-auto w-full space-y-8">
          {/* Name */}
          <div className="space-y-1.5">
            <label
              htmlFor="flow-name"
              className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60"
            >
              {t('flowName')}
            </label>
            <input
              id="flow-name"
              type="text"
              value={editingFlow.name}
              onChange={(e) => handleNameChange(e.target.value)}
              onBlur={handleSaveFlow}
              className="w-full h-10 px-4 text-sm rounded-[8px] border border-border bg-background text-foreground outline-none focus:border-foreground/40 transition-colors"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label
              htmlFor="flow-description"
              className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60"
            >
              {t('flowDescription')}
            </label>
            <textarea
              id="flow-description"
              value={editingFlow.description}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              onBlur={handleSaveFlow}
              className="w-full min-h-[60px] px-4 py-2.5 text-sm rounded-[8px] border border-border bg-background text-foreground outline-none focus:border-foreground/40 transition-colors resize-y"
              placeholder={t('descriptionPlaceholder')}
            />
          </div>

          {/* Steps */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                {t('steps')}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleAddStep}
                className="gap-1.5"
              >
                <Plus size={12} /> {t('addStepBtn')}
              </Button>
            </div>

            {editingFlow.steps.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-accent/5 p-8 text-center">
                <p className="text-sm text-muted-foreground/40">
                  {t('noSteps')}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {editingFlow.steps.map((step, index) => (
                  <div
                    key={stepIds[index] || `fallback-${index}`}
                    className="rounded-xl border border-border bg-accent/5 p-4 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center w-6 h-6 rounded-md bg-primary/10 text-[10px] font-bold text-primary/70">
                        {index + 1}
                      </span>
                      <span className="text-[10px] font-medium text-muted-foreground/50">
                        {t('step')}
                      </span>
                    </div>
                    <textarea
                      value={step.userInstruction}
                      onChange={(e) => handleStepChange(index, e.target.value)}
                      onBlur={handleSaveFlow}
                      className="w-full min-h-[40px] px-3 py-2 text-sm rounded-[6px] border border-border bg-background text-foreground outline-none focus:border-foreground/40 transition-colors resize-y"
                      placeholder={t('stepPlaceholder')}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )
    }

    return null
  }

  return (
    <div className="w-full h-full bg-card flex flex-col text-foreground">
      <div className="flex flex-1 overflow-hidden">
        {/* Flows Sidebar */}
        <div className="w-60 border-r border-border bg-sidebar/50 p-4 space-y-1 shrink-0 overflow-y-auto custom-scrollbar">
          {/* Overview tab */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('overview')
              setEditingFlow(null)
            }}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
              activeTab === 'overview'
                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
            )}
          >
            <Workflow size={16} className="shrink-0" />
            <span>{t('overview')}</span>
          </button>

          {/* Flows group */}
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/40 mt-6 mb-2 px-3">
            {t('flowsGroup')}
          </div>
          {allFlows.length === 0 ? (
            <div className="text-[11px] text-muted-foreground/30 px-3 py-2 italic">
              {t('noFlows')}
            </div>
          ) : (
            allFlows.map((flow) => (
              <button
                key={flow.id}
                type="button"
                onClick={() => handleSelectFlow(flow)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                  activeTab === flow.id
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
                )}
              >
                <Workflow size={16} className="shrink-0" />
                <span className="truncate">{flow.name}</span>
                {flow.steps.length > 0 && (
                  <span className="text-[10px] text-muted-foreground/30 ml-auto">
                    {flow.steps.length}
                  </span>
                )}
              </button>
            ))
          )}

          {/* Add Flow button */}
          <button
            type="button"
            onClick={handleCreateFlow}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 text-muted-foreground hover:text-foreground hover:bg-accent/50"
          >
            <Plus size={16} className="shrink-0" />
            <span>{t('addFlowBtn')}</span>
          </button>

          {/* Executions group */}
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/40 mt-6 mb-2 px-3">
            {t('executionsGroup')}
          </div>
          <div className="text-[11px] text-muted-foreground/30 px-3 py-2 italic">
            {t('noExecutions')}
          </div>
        </div>

        {/* Flows Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex flex-col custom-scrollbar relative">
            {renderTab()}
          </div>
        </div>
      </div>
    </div>
  )
}
