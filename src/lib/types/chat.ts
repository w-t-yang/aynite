import type { TextStreamPart, UIMessage } from 'ai'

export interface SessionMetadata {
  agentName: string
  modelName: string
  createdAt: string
  updatedAt: string
  summary?: string
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
