import { AYNITE_LAYOUT } from './layout'
import type { WorkspaceConfig } from './types'

export const DEFAULT_WORKSPACE_CONFIG: WorkspaceConfig = {
  id: 'Aynite',
  layouts: [AYNITE_LAYOUT],
  activeLayoutId: AYNITE_LAYOUT.id,
  activeAgentId: 'aynite',
  activeSessionId: null,
  folders: [],
  files: [],
}
