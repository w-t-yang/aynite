import type { UIMessage } from 'ai'

/**
 * ChatMessage extends the SDK's UIMessage to include optional createdAt.
 */
export type ChatMessage = UIMessage & {
  createdAt?: Date
}

export interface CommandResultPart {
  command: string
  result: string
  exitCode?: number
}

/**
 * LocalCommandMessage extension.
 */
export interface LocalCommandMessage extends ChatMessage {
  role: 'user'
  commandResults?: CommandResultPart[]
}

export type StreamPart =
  | { type: 'text-delta'; text: string; id?: string }
  | { type: 'reasoning-delta'; text: string; id?: string }
  | {
      type: 'tool-call'
      toolCallId: string
      toolName: string
      args: any
    }
  | {
      type: 'tool-result'
      toolCallId: string
      toolName: string
      result: any
    }
  | {
      type: 'tool-input-delta'
      id: string
      delta: string
    }
  | {
      type: 'finish-step'
      finishReason: string
      usage?: any
    }
  | { type: 'error'; error: string }
  | { type: 'finish' }
  | { type: 'start' }
