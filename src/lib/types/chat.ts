import type { TextStreamPart, UIMessage } from 'ai'

export interface SessionMetadata {
  agentName: string
  modelName: string
  createdAt: string
  updatedAt: string
}

export interface SessionState {
  sessionId: string | null
  messages: UIMessage[]
  loading: boolean
  error: { message: string; redacted: string } | null
  currentStep: TextStreamPart<any> | null
  pendingApproval: { command: string; cwd: string } | null
}
