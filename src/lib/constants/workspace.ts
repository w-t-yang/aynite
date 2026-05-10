import { PLAYBOOK_LAYOUTS, TRADER_LAYOUTS, WRITER_LAYOUTS } from './layout'
import type { WorkspaceConfig } from './types'

export const PLAYBOOK_WORKSPACE_CONFIG: WorkspaceConfig = {
  id: 'Aynite Playbook',
  layouts: PLAYBOOK_LAYOUTS,
  activeLayoutId: 'pb-welcome',
  activeAgentId: 'aynite',
  activeSessionId: null,
  folders: [],
  files: [],
}

export const TRADER_WORKSPACE_CONFIG: WorkspaceConfig = {
  id: 'Market Lens',
  layouts: TRADER_LAYOUTS,
  activeLayoutId: 'trader-desk',
  activeAgentId: 'aynite',
  activeSessionId: null,
  folders: [],
  files: [],
}

export const WRITER_WORKSPACE_CONFIG: WorkspaceConfig = {
  id: 'The Quill',
  layouts: WRITER_LAYOUTS,
  activeLayoutId: 'quill-desk',
  activeAgentId: 'aynite',
  activeSessionId: null,
  folders: [],
  files: [],
}
