import type { TextStreamPart, UIMessage } from 'ai'

export type SessionType = 'general' | 'messenger' | 'flow'

export interface SessionMetadata {
  agentName: string
  modelName: string
  type: SessionType
  createdAt: string
  updatedAt: string
  summary?: string
}

/**
 * Create a UIMessage with a unique ID and a createdAt timestamp.
 * The timestamp is stored as an extra field on the message object and
 * persists through JSON serialization/deserialization.
 */
export function createMessage(
  role: 'system' | 'user' | 'assistant',
  parts: UIMessage['parts'],
): UIMessage {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    role,
    parts,
    createdAt: new Date().toISOString(),
  } as UIMessage
}

export type ErrorType = 'provider' | 'tool' | 'system'

export interface SessionState {
  sessionId: string | null
  messages: UIMessage[]
  loading: boolean
  compacting: boolean
  error: { message: string; redacted: string; type: ErrorType } | null
  currentStep: TextStreamPart<any> | null
  pendingApproval: { command: string; cwd: string } | null
}

/**
 * Internal session container used by ChatService and its extracted services.
 * Wraps SessionState with runtime management fields (abort, approval, save, listeners).
 */
export interface InternalSession {
  state: SessionState
  abortController: AbortController | null
  approvalId: string | null
  lastSavedSnapshot: string
  listeners: Set<(state: SessionState) => void>
  saveTimer: ReturnType<typeof setTimeout> | null
}
