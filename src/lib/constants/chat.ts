/**
 * Chat types aligned with the AI SDK's ModelMessage format for direct
 * compatibility with streamText() — no conversion needed.
 *
 * Content parts: TextPart, ReasoningPart, ToolCallPart, ToolResultPart
 * match the SDK's @ai-sdk/provider-utils types structurally.
 *
 * ChatMessage extends ModelMessage with id + createdAt for session storage.
 */

// ─── Content parts ───────────────────────────────────────────────────

export interface TextPart {
  type: 'text'
  text: string
}

export interface ReasoningPart {
  type: 'reasoning'
  text: string
}

export interface ToolCallPart {
  type: 'tool-call'
  toolCallId: string
  toolName: string
  input: unknown
}

export interface ToolResultPart {
  type: 'tool-result'
  toolCallId: string
  toolName: string
  output: unknown
}

// ─── Message type (matches AI SDK ModelMessage structurally) ─────────

export type ChatMessage = {
  id: string
  createdAt: number
} & (
  | { role: 'system'; content: string }
  | { role: 'user'; content: string | Array<TextPart> }
  | {
      role: 'assistant'
      content:
        | string
        | Array<TextPart | ReasoningPart | ToolCallPart | ToolResultPart>
    }
  | { role: 'tool'; content: Array<ToolResultPart> }
)

// ─── Stream parts (IPC protocol between main and renderer) ───────────

export type StreamPart =
  | { type: 'text-delta'; content: string }
  | { type: 'reasoning-delta'; content: string }
  | {
      type: 'tool-call'
      toolCallId: string
      toolName: string
      args: string
    }
  | {
      type: 'tool-result'
      toolCallId: string
      toolName: string
      content: string
    }
  | {
      type: 'step-finish'
      finishReason: string
      usage?: { promptTokens?: number; completionTokens?: number }
    }
  | { type: 'error'; error: string }
  | { type: 'finish' }
