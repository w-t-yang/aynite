import type { AgentStepEvent, ChatMessage } from './types'
import { prepareMessagesForApi } from './prepare-messages'

export interface AgentConfig {
  provider: string
  apiKey: string
  baseUrl: string
  model: string
  compatibility?: 'openai' | 'anthropic' | 'google'
  enabledTools?: { [key: string]: boolean }
  agentPromptFiles?: string[]
}

const genId = () => Math.random().toString(36).slice(2, 11)

export async function runAgentLoop(
  userMessage: string,
  history: ChatMessage[],
  config: AgentConfig,
  workspaceFolders: string[],
  onEvent: (event: AgentStepEvent) => void,
  requestApproval: (command: string, cwd: string) => Promise<boolean>,
  activeFile?: string,
  abortSignal?: AbortSignal,
): Promise<ChatMessage[]> {
  const fullHistory: ChatMessage[] = [...history]

  const hasSystem = fullHistory.some((m) => m.role === 'system')
  if (!hasSystem) {
    console.log(
      '[Agent] No system prompt found in history, fetching merged prompt for agent files:',
      config.agentPromptFiles,
    )
    const sysPrompt = await window.aynite.getMergedSystemPrompt(
      undefined,
      config.agentPromptFiles,
    )
    console.log(
      '[Agent] Injected system prompt length:',
      (sysPrompt || '').length,
    )
    const sysMsg: ChatMessage = {
      id: genId(),
      role: 'system',
      content: sysPrompt,
    }
    fullHistory.unshift(sysMsg)
  }

  const apiMessages = prepareMessagesForApi(fullHistory)
  const userMsg: ChatMessage = {
    id: genId(),
    role: 'user',
    content: userMessage,
  }
  apiMessages.push({ role: 'user', content: userMsg.content })

  console.log('[Agent] Sending messages to backend:', apiMessages.length)

  let requestId
  try {
    const res = await window.aynite.aiChat({
      messages: apiMessages,
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
    requestId = res.requestId
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    const errorMsg: ChatMessage = {
      id: genId(),
      role: 'assistant',
      content: `❌ **AI Error**: ${message}`,
    }
    onEvent({ type: 'error', content: `AI Error: ${message}` })
    return [...fullHistory, userMsg, errorMsg]
  }

  return new Promise((fulfill) => {
    const loopMessages: ChatMessage[] = []
    let currentAssistantMsg: ChatMessage | null = null
    const currentToolCalls: any[] = []

    const finalizeAssistantMsg = () => {
      if (currentAssistantMsg) {
        currentAssistantMsg.tool_calls = [...currentToolCalls]
        loopMessages.push(currentAssistantMsg)
        currentAssistantMsg = null
        currentToolCalls.length = 0
      }
    }

    const ensureAssistantMsg = () => {
      if (!currentAssistantMsg) {
        currentAssistantMsg = {
          id: genId(),
          role: 'assistant',
          content: '',
          thinking: '',
          tool_calls: [],
        }
      }
    }

    // Listen for approval requests
    const removeApprovalListener = window.aynite.onAiApprovalRequest(
      async (data: { id: string; command: string; cwd: string }) => {
        onEvent({
          type: 'approval_request',
          content: `Run command: ${data.command}`,
          toolName: 'run_command',
          toolArgs: { command: data.command, cwd: data.cwd },
          approvalId: data.id,
        })
        const approved = await requestApproval(data.command, data.cwd)
        window.aynite.respondToAiApproval(data.id, approved)
      },
    )

    const removeDeltaListener = window.aynite.onAiChatDelta(
      requestId,
      (part: any) => {
        if (abortSignal?.aborted) {
          removeDeltaListener()
          removeApprovalListener()
          onEvent({ type: 'error', content: 'Request aborted.' })
          finalizeAssistantMsg()
          fulfill([...fullHistory, userMsg, ...loopMessages])
          return
        }

        switch (part.type) {
          case 'text-delta':
            ensureAssistantMsg()
            currentAssistantMsg!.content += part.text || ''
            onEvent({ type: 'text_delta', content: part.text || '' })
            break

          case 'reasoning-delta': {
            ensureAssistantMsg()
            const reasoning = part.text || '' // TextStreamPart 'reasoning-delta' uses the 'text' field
            currentAssistantMsg!.thinking += reasoning
            onEvent({ type: 'thinking', content: reasoning })
            break
          }

          case 'tool-call': {
            ensureAssistantMsg()
            const call = {
              toolName: part.toolName,
              args: part.input || part.args,
              toolCallId: part.toolCallId,
            }
            currentToolCalls.push(call)
            onEvent({
              type: 'tool_call',
              content: `Calling ${part.toolName}`,
              toolName: part.toolName,
              toolArgs: call.args,
              toolCallId: part.toolCallId,
            })
            break
          }

          case 'tool-result': {
            // Extract the actual result string from the output object (v6) or result field
            let resultValue = ''
            if (typeof part.output === 'string') {
              resultValue = part.output
            } else if (part.output && typeof part.output === 'object') {
              resultValue = part.output.value || JSON.stringify(part.output)
            } else {
              resultValue = part.result || JSON.stringify(part || '')
            }

            // Tool results are separate messages in the history
            const resultMsg: ChatMessage = {
              id: genId(),
              role: 'tool',
              content: resultValue,
              tool_call_id: part.toolCallId,
              name: part.toolName,
            }

            // Before adding a tool result, we should finalize the preceding assistant message
            finalizeAssistantMsg()
            loopMessages.push(resultMsg)

            onEvent({
              type: 'tool_result',
              content: resultValue,
              toolName: part.toolName,
              toolCallId: part.toolCallId,
            })
            break
          }

          case 'step-finish':
            finalizeAssistantMsg()
            break

          case 'error': {
            removeDeltaListener()
            removeApprovalListener()
            onEvent({
              type: 'error',
              content: part.error || part.message || 'Unknown stream error',
            })
            finalizeAssistantMsg()
            const errorMsg: ChatMessage = {
              id: genId(),
              role: 'assistant',
              content: `❌ **AI Stream Error**: ${part.error || part.message || 'Unknown stream error'}`,
            }
            fulfill([...fullHistory, userMsg, ...loopMessages, errorMsg])
            break
          }

          case 'finish':
            removeDeltaListener()
            removeApprovalListener()
            finalizeAssistantMsg()
            fulfill([...fullHistory, userMsg, ...loopMessages])
            break
        }
      },
    )
  })
}
