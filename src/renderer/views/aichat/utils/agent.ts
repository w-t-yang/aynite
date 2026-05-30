import type { AgentLoopConfig } from '../../../../lib/types/ai'

export type { AgentLoopConfig }

import type { TextStreamPart, UIMessage } from 'ai'
import { aiMutations } from '../../../bridge/ai'
import { genId } from './message'

export async function runAgentLoop(
  messages: UIMessage[],
  config: AgentLoopConfig,
  workspaceFolders: string[],
  onEvent: (event: TextStreamPart<any>) => void,
  activeFile: string,
  abortSignal: AbortSignal,
  registerStream: (
    requestId: string,
    handler: (part: any) => void,
  ) => () => void,
  workspaceName?: string,
): Promise<UIMessage[]> {
  const loopMessages: UIMessage[] = []
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
        parts.push({ type: 'reasoning', text: reasoningAccum, state: 'done' })
      }

      if (textAccum) {
        parts.push({ type: 'text', text: textAccum, state: 'done' })
      }

      if (currentStepToolCalls.length > 0) {
        currentStepToolCalls.forEach((tc) => {
          parts.push({
            type: 'dynamic-tool',
            toolCallId: tc.toolCallId,
            toolName: tc.toolName,
            state: 'input-available',
            input: tc.input || tc.args,
          } as any)
        })
      }

      loopMessages.push({
        id: genId(),
        role: 'assistant',
        parts,
      })
      textAccum = ''
      reasoningAccum = ''
      currentStepToolCalls = []
    }
  }

  return new Promise((fulfill, reject) => {
    aiMutations
      .chat({
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
        workspaceName,
      })
      .then((res: { requestId?: string }) => {
        const requestId = res.requestId
        if (!requestId) {
          fulfill([...messages, ...loopMessages])
          return
        }
        const unsubscribe = registerStream(requestId, (part: any) => {
          if (abortSignal.aborted) {
            unsubscribe()
            fulfill([...messages, ...loopMessages])
            return
          }

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
              const _input = matchingCall?.input || matchingCall?.args || {}

              flushAssistant()

              // Update the matching dynamic-tool part in the last assistant message
              if (loopMessages.length > 0) {
                const last = loopMessages[loopMessages.length - 1]
                const parts = [...last.parts]
                const idx = parts.findIndex(
                  (p) =>
                    p.type === 'dynamic-tool' &&
                    p.toolCallId === part.toolCallId,
                )
                if (idx !== -1) {
                  parts[idx] = {
                    ...parts[idx],
                    state: 'output-available',
                    output: part.output,
                  } as any
                  loopMessages[loopMessages.length - 1] = { ...last, parts }
                }
              }

              onEvent(part)
              break
            }

            // Real-time command output streaming while run_command is executing
            case 'command-output': {
              const text = (part as any).text
              if (text && loopMessages.length > 0) {
                const last = loopMessages[loopMessages.length - 1]
                const parts = [...last.parts]
                // Find the last run_command tool part that's still executing
                for (let i = parts.length - 1; i >= 0; i--) {
                  const p = parts[i] as any
                  if (
                    p.type === 'dynamic-tool' &&
                    p.toolName === 'run_command' &&
                    (p.state === 'input-available' || p.state === 'executing')
                  ) {
                    const currentOutput = (p as any).output || ''
                    parts[i] = {
                      ...p,
                      state: 'executing',
                      output: currentOutput + text,
                    } as any
                    loopMessages[loopMessages.length - 1] = { ...last, parts }
                    onEvent(part as any)
                    break
                  }
                }
              }
              break
            }

            case 'finish-step':
              onEvent(part)
              break

            case 'error': {
              unsubscribe()
              flushAssistant()
              onEvent(part)
              fulfill([...messages, ...loopMessages])
              break
            }

            case 'finish':
              unsubscribe()
              flushAssistant()
              onEvent({ type: 'finish' } as any)
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
