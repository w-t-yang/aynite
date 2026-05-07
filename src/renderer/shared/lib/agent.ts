import type {
  ChatMessage,
  ReasoningPart,
  StreamPart,
  TextPart,
  ToolCallPart,
  ToolResultPart,
} from '../../../lib/constants/chat'

export interface AgentConfig {
  provider: string
  apiKey: string
  baseUrl: string
  model: string
  compatibility?: 'openai' | 'anthropic' | 'google'
  enabledTools?: { [key: string]: boolean }
  agentPromptFiles?: string[]
}

const genId = () =>
  `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`

export async function runAgentLoop(
  userMessage: string,
  history: ChatMessage[],
  config: AgentConfig,
  workspaceFolders: string[],
  onEvent: (event: StreamPart) => void,
  requestApproval: (command: string, cwd: string) => Promise<boolean>,
  activeFile?: string,
  abortSignal?: AbortSignal,
  subscribe?: (callback: (event: any) => void) => () => void,
): Promise<ChatMessage[]> {
  const fullHistory: ChatMessage[] = [...history]

  const hasSystem = fullHistory.some((m) => m.role === 'system')
  if (!hasSystem) {
    const sysPrompt = await window.aynite.getMergedSystemPrompt(
      undefined,
      config.agentPromptFiles,
    )
    fullHistory.unshift({
      id: genId(),
      role: 'system',
      content: sysPrompt,
      createdAt: Date.now(),
    })
  }

  const userMsg: ChatMessage = {
    id: genId(),
    role: 'user',
    content: userMessage,
    createdAt: Date.now(),
  }

  let requestId: string
  try {
    const res = await window.aynite.aiChat({
      messages: [...fullHistory, userMsg],
      config: {
        provider: config.provider,
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        model: config.model,
        compatibility: config.compatibility,
        enabledTools: config.enabledTools,
      },
      workspaceFolders,
      activeFile,
    })
    if (!res.requestId) throw new Error('Failed to start AI chat: No requestId')
    requestId = res.requestId
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    const errorMsg: ChatMessage = {
      id: genId(),
      role: 'assistant',
      content: `**AI Error**: ${message}`,
      createdAt: Date.now(),
    }
    onEvent({ type: 'error', error: message })
    return [...fullHistory, userMsg, errorMsg]
  }

  return new Promise((fulfill) => {
    const loopMessages: ChatMessage[] = []

    // Accumulators for the current step
    let textAccum = ''
    let reasoningAccum = ''
    let toolCalls: ToolCallPart[] = []

    function flushAssistant() {
      const parts: Array<TextPart | ReasoningPart | ToolCallPart> = []
      if (textAccum) parts.push({ type: 'text', text: textAccum })
      if (reasoningAccum)
        parts.push({ type: 'reasoning', text: reasoningAccum })
      parts.push(...toolCalls)

      if (parts.length > 0) {
        const content =
          parts.length === 1 && parts[0].type === 'text' ? parts[0].text : parts

        loopMessages.push({
          id: genId(),
          role: 'assistant' as const,
          content,
          createdAt: Date.now(),
        })
      }

      textAccum = ''
      reasoningAccum = ''
      toolCalls = []
    }

    if (!subscribe) {
      console.error('[Agent] No subscription provided for AI events')
      fulfill([...fullHistory, userMsg])
      return
    }

    const unsubscribe = subscribe((event: any) => {
      if (abortSignal?.aborted) {
        unsubscribe()
        flushAssistant()
        fulfill([...fullHistory, userMsg, ...loopMessages])
        return
      }

      if (event.type === 'ai-approval-request') {
        const data = event.data
        onEvent({
          type: 'tool-call',
          toolCallId: data.id,
          toolName: 'run_command',
          args: JSON.stringify({ command: data.command, cwd: data.cwd }),
        })
        requestApproval(data.command, data.cwd).then((approved) => {
          window.aynite.respondToAiApproval(data.id, approved)
        })
      } else if (event.type === 'ai-chat-delta') {
        const { requestId: eventReqId, part } = event.data
        if (eventReqId !== requestId) return

        switch (part.type) {
          case 'text-delta':
            textAccum += part.content
            onEvent(part)
            break

          case 'reasoning-delta':
            reasoningAccum += part.content
            onEvent(part)
            break

          case 'tool-call': {
            let input: unknown = part.args
            try {
              input = JSON.parse(part.args)
            } catch {
              // use raw string if not valid JSON
            }
            toolCalls.push({
              type: 'tool-call',
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              input,
            })
            onEvent(part)
            break
          }

          case 'tool-result': {
            flushAssistant()
            const resultPart: ToolResultPart = {
              type: 'tool-result',
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              output: part.content,
            }
            loopMessages.push({
              id: genId(),
              role: 'tool',
              content: [resultPart],
              createdAt: Date.now(),
            })
            onEvent(part)
            break
          }

          case 'step-finish':
            onEvent(part)
            break

          case 'error': {
            unsubscribe()
            flushAssistant()
            onEvent(part)
            const errorMsg: ChatMessage = {
              id: genId(),
              role: 'assistant',
              content: `**AI Stream Error**: ${part.error}`,
              createdAt: Date.now(),
            }
            fulfill([...fullHistory, userMsg, ...loopMessages, errorMsg])
            break
          }

          case 'finish':
            unsubscribe()
            flushAssistant()
            fulfill([...fullHistory, userMsg, ...loopMessages])
            break
        }
      }
    })
  })
}
