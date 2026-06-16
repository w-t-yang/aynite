import type { TextStreamPart, UIMessage } from 'ai'

export interface SessionMetadata {
  agentName: string
  modelName: string
  createdAt: string
  updatedAt: string
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
