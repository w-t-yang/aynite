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
  /** Callback to stream real-time command output during run_command tool execution */
  onCommandProgress?: (text: string) => void
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

export interface ViewConfig {
  name: string
  description: string
  author: string
  version: string
  expected_file_type?: {
    ext: string
    schema: Record<string, unknown>
  }
  key_bindings: Record<string, unknown>
}
