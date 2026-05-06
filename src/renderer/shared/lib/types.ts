import type { Keybinding, KeybindingConfig } from '../../../lib/constants/types'

export type { Keybinding, KeybindingConfig }

import type { ChatMessage, StreamPart } from '../../../lib/constants/chat'

export type { ChatMessage, StreamPart }

export interface AIProviderInstance {
  id: string
  name: string
  provider: 'ollama' | 'openai' | 'anthropic' | 'gemini' | 'deepseek' | 'others'
  apiKey?: string
  url?: string
  model: string
  compatibility?: 'openai' | 'anthropic' | 'google'
  contextWindow?: number
}

export interface Agent {
  id: string
  name: string
  promptFiles: string[]
}

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
