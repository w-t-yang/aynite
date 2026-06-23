import type { FlowDefinition } from '../../lib/types/flows'

declare const aynite: any

export const flows = {
  list: (): Promise<FlowDefinition[]> => aynite.flowList(),
  create: (): Promise<FlowDefinition> => aynite.flowCreate(),
  update: (
    flowId: string,
    updates: Partial<FlowDefinition>,
  ): Promise<FlowDefinition> => aynite.flowUpdate(flowId, updates),
}
