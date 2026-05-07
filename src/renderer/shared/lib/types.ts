import type { Keybinding, KeybindingConfig } from '../../../lib/constants/types'

export type { Keybinding, KeybindingConfig }

import type { ChatMessage, StreamPart } from '../../../lib/types/chat'

export type { ChatMessage, StreamPart }

import type { Agent, AIProviderInstance } from '../../../lib/types/ai'

export type { Agent, AIProviderInstance }

export interface SettingsState {
  activeTheme: string
  ai: {
    activeId: string
    providers: AIProviderInstance[]
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
}
