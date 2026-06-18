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
  /** Controls the model's reasoning/thinking behavior.
   *  - 'off': No reasoning (fastest, recommended for simple tasks)
   *  - 'low': Minimal reasoning
   *  - 'medium': Moderate reasoning (default-like)
   *  - 'high': Maximum reasoning (deep thinking, slower)
   *  Maps to each provider's native API (reasoning_effort, thinking, etc.) */
  reasoningEffort?: 'off' | 'low' | 'medium' | 'high'
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
  /** The workspace name this AI chat session belongs to */
  workspaceName?: string
  /** Callback to stream real-time command output during run_command tool execution */
  onCommandProgress?: (text: string) => void
  /** If true, command execution is auto-approved without renderer approval dialog */
  autoApproveCommands?: boolean
}

export interface MessengerConfig {
  id: string
  name: string
  type: 'telegram'
  apiKey: string
  workspace: string
  enabled: boolean
  /** Telegram user IDs (as strings) that are allowed to interact with this bot.
   *  Leave empty to allow anyone. */
  whitelist: string[]
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
