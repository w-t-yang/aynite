export interface PromptDefinition {
  content: string
  filename: string
}

export interface AIProvider {
  id: string
  name: string
  provider: 'ollama' | 'openai' | 'anthropic' | 'gemini' | 'deepseek' | 'others'
  apiKey?: string
  baseUrl?: string
  model: string
  compatibility?: 'openai' | 'anthropic' | 'google'
  contextWindow?: number
}

export interface Agent {
  id: string
  name: string
  description?: string
  promptFiles: string[]
}

export interface ToolContext {
  workspaceFolders: string[]
  activeFile?: string
}

export interface AgentLoopConfig extends AIProvider {
  enabledTools?: Record<string, boolean>
  agentPromptFiles?: string[]
}

export interface SuggestionItem {
  id: string
  name?: string
  isDirectory?: boolean
  label?: string
  error?: string
  subtitle?: string
}
