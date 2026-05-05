import type { Keybinding, KeybindingConfig } from '../../../lib/constants/types'

export type { Keybinding, KeybindingConfig }

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'model' | 'tool' | 'system'
  content: string
  tool_calls?: any[]
  tool_call_id?: string
  name?: string
  thinking?: string
}

export interface AgentStepEvent {
  type:
    | 'thinking'
    | 'tool_call'
    | 'tool_result'
    | 'text_delta'
    | 'text_done'
    | 'error'
    | 'approval_request'
  content: string
  toolName?: string
  toolArgs?: Record<string, any>
  toolCallId?: string
  approvalId?: string
}

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
