import { DEFAULT_LAYOUTS } from './layout'
import type { WorkspaceConfig } from './types'

export const DEFAULT_WORKSPACE_ID = 'Aynite Playbook'

export const DEFAULT_WORKSPACE_CONFIG: WorkspaceConfig = {
  id: DEFAULT_WORKSPACE_ID,
  layouts: DEFAULT_LAYOUTS,
  activeLayoutId: 'layout-chat',
  folders: [],
  files: [],
}
