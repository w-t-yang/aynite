import type { KeybindingConfig } from '../constants/types'
import type { Agent, AIProvider, MessengerConfig } from './ai'

export interface SettingsState {
  activeTheme: string
  ai: {
    activeId: string
    providers: AIProvider[]
  }
  agents: {
    activeId: string
    list: Agent[]
  }
  skills?: {
    folders: string[]
  }
  commands?: {
    folders: string[]
  }
  keybindings: KeybindingConfig
  prompts: {
    files: string[]
  }
  aiTools: { [key: string]: boolean }
  messengers?: MessengerConfig[]
}
