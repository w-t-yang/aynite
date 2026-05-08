import type { AIProvider } from '../../../../lib/types/ai'
import type {
  ChatMessage,
  StreamPart,
  ToolCallPart,
  ToolResultPart,
} from '../../../../lib/types/chat'
import { genId } from './message'

export interface AgentLoopConfig extends AIProvider {
  enabledTools?: Record<string, boolean>
  agentPromptFiles?: string[]
}

export async function runAgentLoop(
  userText: string,
  fullHistory: ChatMessage[],
  config: AgentLoopConfig,
  workspaceFolders: string[],
  onEvent: (event: StreamPart) => void,
  _requestApproval: (command: string, cwd: string) => Promise<boolean>,
  activeFile: string,
  abortSignal: AbortSignal,
  subscribe: (handler: (event: any) => void) => () => void,
): Promise<ChatMessage[]> {
  const userMsg: ChatMessage = {
    id: genId(),
    role: 'user',
    content: userText,
    createdAt: Date.now(),
  }

  const loopMessages: ChatMessage[] = []
  const _assistantAccum = ''
  let reasoningAccum = ''
  let textAccum = ''
  let toolCalls: ToolCallPart[] = []

  const flushAssistant = () => {
    if (textAccum || reasoningAccum || toolCalls.length > 0) {
      const content: any[] = []
      if (reasoningAccum)
        content.push({ type: 'reasoning', text: reasoningAccum })
      if (textAccum) content.push({ type: 'text', text: textAccum })
      if (toolCalls.length > 0) content.push(...toolCalls)

      const assistantMsg: ChatMessage = {
        id: genId(),
        role: 'assistant',
        content:
          content.length === 1 && content[0].type === 'text'
            ? content[0].text
            : content,
        createdAt: Date.now(),
      }
      loopMessages.push(assistantMsg)
      textAccum = ''
      reasoningAccum = ''
      toolCalls = []
    }
  }

  return new Promise((fulfill, reject) => {
    window.aynite
      .aiChat({
        messages: [...fullHistory, userMsg, ...loopMessages],
        config: {
          id: 'temp',
          name: 'Temp',
          provider: config.provider,
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          model: config.model,
          compatibility: config.compatibility,
          enabledTools: config.enabledTools,
        },
        workspaceFolders,
        activeFile,
      })
      .then((res: { requestId?: string }) => {
        const requestId = res.requestId
        if (!requestId) {
          fulfill([...fullHistory, userMsg, ...loopMessages])
          return
        }
        const unsubscribe = subscribe(async (event: any) => {
          if (
            event.type !== 'ai-chat-delta' ||
            event.data.requestId !== requestId
          )
            return
          if (abortSignal.aborted) {
            unsubscribe()
            fulfill([...fullHistory, userMsg, ...loopMessages])
            return
          }

          const part = event.data.part as StreamPart
          switch (part.type) {
            case 'text-delta':
              textAccum += part.text
              onEvent(part)
              break

            case 'reasoning-delta':
              reasoningAccum += part.text
              onEvent(part)
              break

            case 'tool-input-delta':
              onEvent(part)
              break

            case 'tool-call': {
              const existingIdx = toolCalls.findIndex(
                (tc) => tc.toolCallId === part.toolCallId,
              )
              if (existingIdx !== -1) {
                toolCalls[existingIdx] = {
                  type: 'tool-call',
                  toolCallId: part.toolCallId,
                  toolName: part.toolName,
                  input: part.input,
                }
              } else {
                toolCalls.push({
                  type: 'tool-call',
                  toolCallId: part.toolCallId,
                  toolName: part.toolName,
                  input: part.input,
                })
              }
              onEvent(part)
              break
            }

            case 'tool-result': {
              flushAssistant()
              const resultPart: ToolResultPart = {
                type: 'tool-result',
                toolCallId: part.toolCallId,
                toolName: part.toolName,
                output: part.output,
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

            case 'finish-step':
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
              onEvent({ type: 'finish' })
              fulfill([...fullHistory, userMsg, ...loopMessages])
              break
          }
        })

        abortSignal.addEventListener('abort', () => {
          unsubscribe()
          fulfill([...fullHistory, userMsg, ...loopMessages])
        })
      })
      .catch((err: any) => {
        reject(err)
      })
  })
}
