import { SYSTEM_LAYOUTS } from './layout'
import type { WorkspaceConfig } from './types'

export const DEFAULT_WORKSPACE_CONFIG: WorkspaceConfig = {
  id: 'Aynite',
  layouts: [...SYSTEM_LAYOUTS],
  activeLayoutId: SYSTEM_LAYOUTS[0].id,
  activeAgentId: 'aynite',
  activeSessionId: null,
  folders: [],
  files: [],
}
