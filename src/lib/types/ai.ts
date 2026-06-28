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
  /** An introduction or greeting for this agent (e.g. shown in UI) */
  introduction?: string
  /** Per-agent tool enable/disable overrides.
   *  Keys are tool IDs, values are whether the tool is enabled.
   *  Missing keys inherit the default (enabled). */
  tools?: Record<string, boolean>
  /** Icon identifier used for display in the settings sidebar.
   *  Matches keys in ICON_OPTIONS (e.g. 'sparkles', 'bot', 'brain', etc.) */
  icon?: string
}

export interface ToolContext {
  workspaceFolders: string[]
  activeFile?: string
  /** The workspace name this AI chat session belongs to */
  workspaceName?: string
  /** Directory where the session stores messages.json and metadata.json */
  sessionDir?: string
  /** Callback to stream real-time command output during run_command tool execution */
  onCommandProgress?: (text: string) => void
  /** If true, command execution is auto-approved without renderer approval dialog */
  autoApproveCommands?: boolean
}

export interface MessengerConfig {
  id: string
  provider: 'telegram' | 'discord'
  apiKey: string
  enabled: boolean
  /** The bot's display name (e.g. "MyBot" for Telegram, "MyBot#1234" for Discord).
   *  Populated when the bot successfully connects. */
  botName?: string
  /** Whether the bot successfully connected and is currently running.
   *  Set to true on successful launch, false on failure or when stopped.
   *  Used by the UI to show a green (connected) or red (disconnected/failed) dot. */
  connected?: boolean
  /** Error message from the last failed connection attempt.
   *  Cleared when the bot successfully connects. */
  lastError?: string
  /** User IDs or @usernames that are allowed to interact with this bot.
   *  If empty or not set, no one is allowed. */
  whitelist?: string[]
  /** Number of recent group messages to keep as context when the bot is
   *  @mentioned. Defaults to 100. */
  contextSize?: number
  /** The agent ID bound to this bot. Used to determine agent name and introduction. */
  agentId?: string
  /** The working project folder path for this bot. */
  projectFolder?: string
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
