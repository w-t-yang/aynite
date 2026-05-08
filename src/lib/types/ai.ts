export interface PromptDefinition {
  content: string
  filename: string
}

export interface AIProvider {
  id?: string
  name?: string
  provider: string
  apiKey?: string
  baseUrl?: string
  url?: string // Alias for baseUrl sometimes
  model: string
  compatibility?: 'openai' | 'anthropic' | 'google'
  enabledTools?: { [key: string]: boolean }
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
  description?: string
  promptFiles: string[]
}

export interface AgentConfig {
  provider: string
  apiKey: string
  baseUrl: string
  model: string
  compatibility?: 'openai' | 'anthropic' | 'google'
  enabledTools?: { [key: string]: boolean }
  agentPromptFiles?: string[]
}

export interface ToolContext {
  workspaceFolders: string[]
  activeFile?: string
}
