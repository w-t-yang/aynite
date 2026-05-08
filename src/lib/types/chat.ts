/**
 * Content part types (matches AI SDK 6.0.169 structure)
 */
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
  args: unknown
}

export interface ToolResultPart {
  type: 'tool-result'
  toolCallId: string
  toolName: string
  result: unknown
}

export interface CommandResultPart {
  command: string
  result: string
  exitCode?: number
}

// ─── Message type (matches AI SDK ModelMessage structurally) ─────────

export type ChatMessage = {
  id: string
  createdAt: number
} & (
  | { role: 'system'; content: string }
  | {
      role: 'user'
      content: string | Array<TextPart>
      commandResults?: CommandResultPart[]
    }
  | {
      role: 'assistant'
      content:
        | string
        | Array<TextPart | ReasoningPart | ToolCallPart | ToolResultPart>
    }
  | { role: 'tool'; content: Array<ToolResultPart> }
)

// ─── Stream parts (IPC protocol between main and renderer) ───────────
// Matches Vercel AI SDK v6.0.169 TextStreamPart union.
// Definition: node_modules/ai/dist/index.d.ts:2601

export type StreamPart =
  | { type: 'text-delta'; text: string; id?: string }
  | { type: 'reasoning-delta'; text: string; id?: string }
  | {
      type: 'tool-call'
      toolCallId: string
      toolName: string
      args: unknown
    }
  | {
      type: 'tool-result'
      toolCallId: string
      toolName: string
      result: unknown
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
