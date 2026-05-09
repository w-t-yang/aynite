import type { AIProvider } from '../../../../lib/types/ai'
import type { ChatMessage, StreamPart } from '../../../../lib/types/chat'
import { genId } from './message'

export interface AgentLoopConfig extends AIProvider {
  enabledTools?: Record<string, boolean>
  agentPromptFiles?: string[]
}

export async function runAgentLoop(
  messages: ChatMessage[],
  config: AgentLoopConfig,
  workspaceFolders: string[],
  onEvent: (event: StreamPart) => void,
  activeFile: string,
  abortSignal: AbortSignal,
  subscribe: (handler: (event: any) => void) => () => void,
): Promise<ChatMessage[]> {
  const loopMessages: ChatMessage[] = []
  let reasoningAccum = ''
  let textAccum = ''

  // Track all tool calls in this loop to preserve their inputs for results
  const allToolCalls = new Map<string, any>()
  // Current step's tool calls for the next assistant message
  let currentStepToolCalls: any[] = []

  const flushAssistant = () => {
    if (textAccum || reasoningAccum || currentStepToolCalls.length > 0) {
      const parts: any[] = []

      if (reasoningAccum) {
        parts.push({ type: 'reasoning', text: reasoningAccum })
      }

      if (textAccum) {
        parts.push({ type: 'text', text: textAccum })
      }

      if (currentStepToolCalls.length > 0) {
        currentStepToolCalls.forEach((tc) => {
          parts.push({
            type: 'dynamic-tool',
            toolCallId: tc.toolCallId,
            toolName: tc.toolName,
            state: 'input-available',
            input: tc.args || tc.input,
          })
        })
      }

      const assistantMsg: ChatMessage = {
        id: genId(),
        role: 'assistant',
        parts,
        createdAt: new Date(),
      }

      loopMessages.push(assistantMsg)
      textAccum = ''
      reasoningAccum = ''
      currentStepToolCalls = []
    }
  }

  return new Promise((fulfill, reject) => {
    window.aynite
      .aiChat({
        messages: [...messages, ...loopMessages],
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
          fulfill([...messages, ...loopMessages])
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
            fulfill([...messages, ...loopMessages])
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
              allToolCalls.set(part.toolCallId, part)
              const existingIdx = currentStepToolCalls.findIndex(
                (tc) => tc.toolCallId === part.toolCallId,
              )
              if (existingIdx !== -1) {
                currentStepToolCalls[existingIdx] = part
              } else {
                currentStepToolCalls.push(part)
              }
              onEvent(part)
              break
            }

            case 'tool-result': {
              const matchingCall = allToolCalls.get(part.toolCallId)
              const args = matchingCall?.args || matchingCall?.input || {}

              flushAssistant()
              loopMessages.push({
                id: genId(),
                role: 'assistant',
                parts: [
                  {
                    type: 'dynamic-tool',
                    toolCallId: part.toolCallId,
                    toolName: part.toolName,
                    state: 'output-available',
                    input: args,
                    output: part.result ?? (part as any).output,
                  } as any,
                ],
                createdAt: new Date(),
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
                parts: [
                  { type: 'text', text: `**AI Stream Error**: ${part.error}` },
                ],
                createdAt: new Date(),
              }
              fulfill([...messages, ...loopMessages, errorMsg])
              break
            }

            case 'finish':
              unsubscribe()
              flushAssistant()
              onEvent({ type: 'finish' })
              fulfill([...messages, ...loopMessages])
              break
          }
        })

        abortSignal.addEventListener('abort', () => {
          unsubscribe()
          fulfill([...messages, ...loopMessages])
        })
      })
      .catch((err: any) => {
        reject(err)
      })
  })
}
