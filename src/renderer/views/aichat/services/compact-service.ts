/**
 * CompactService — Context compaction for long AI chat sessions.
 *
 * Summarizes older messages to reduce token usage while preserving
 * key context. Creates backups before compaction and uses the AI
 * itself to generate concise summaries (no tools).
 */

import type { UIMessage } from 'ai'
import type { InternalSession } from '../../../../lib/types/chat'
import { aiMutations } from '../../../bridge/ai'
import { config } from '../../../bridge/config'
import { estimateTokenCount, genId } from '../utils/message'
import {
  registerStreamHandler,
  unregisterStreamHandler,
} from './stream-dispatcher'

/**
 * Compact a session's context by summarizing older messages.
 *
 * Algorithm:
 * 1. Find the last user message in the list. Everything before it
 *    (including the system message) will be summarized.
 * 2. Save the full pre-compacted messages to a backup file.
 * 3. Build summary messages and send to AI (no tools).
 * 4. Replace old messages with: system + summary + last user + subsequent.
 * 5. Save compacted messages with updated metadata.
 *
 * @param session - The internal session to compact
 * @param updateState - Callback to update session state and notify listeners
 */
export async function compactContext(
  session: InternalSession,
  updateState: (patch: Record<string, unknown>) => void,
): Promise<void> {
  if (!session || session.state.messages.length === 0) return

  // Prevent concurrent operations
  if (session.state.loading || session.state.compacting) return

  // Set compacting state
  updateState({ compacting: true })

  try {
    const allMessages = session.state.messages
    const sessionId = session.state.sessionId
    if (!sessionId) {
      updateState({ compacting: false })
      return
    }

    // Step 1: Find the last user message
    let lastUserIdx = -1
    for (let i = allMessages.length - 1; i >= 0; i--) {
      if (allMessages[i].role === 'user') {
        lastUserIdx = i
        break
      }
    }
    if (lastUserIdx < 0) {
      updateState({ compacting: false })
      return
    }

    // Messages to summarize: everything before lastUserIdx
    const toSummarize = allMessages.slice(0, lastUserIdx)
    // Messages after (and including) the last user message
    const afterLastUser = allMessages.slice(lastUserIdx)

    // Step 2: Save backup of the full pre-compacted messages
    // Saved as compacted-<timestamp>.json inside the session's directory.
    const timestamp = Date.now()
    await aiMutations.saveCompactBackup(sessionId, timestamp, allMessages)

    // Step 3: Build summary messages
    const systemMsg = toSummarize.find((m) => m.role === 'system')
    const nonSystemToSummarize = toSummarize.filter((m) => m.role !== 'system')

    const summaryPrompt =
      'Please summarize the above conversation concisely, preserving all key information, decisions, and context. Focus on the essential points that would be needed to continue the conversation.'

    const summaryMessages: UIMessage[] = systemMsg
      ? [systemMsg, ...nonSystemToSummarize]
      : nonSystemToSummarize

    const summaryRequestMsg: UIMessage = {
      id: genId(),
      role: 'user',
      parts: [{ type: 'text', text: summaryPrompt }],
    }
    summaryMessages.push(summaryRequestMsg)

    // Step 4: Send to AI for summarization (no tools)
    const aiConfig = await config.get('ai')
    const activeProvider =
      aiConfig?.providers?.find((p: any) => p.id === aiConfig.activeId) ||
      aiConfig?.providers?.[0]

    if (!activeProvider) {
      updateState({ compacting: false })
      return
    }

    const result = await new Promise<string>((resolve, reject) => {
      aiMutations
        .chat({
          messages: summaryMessages,
          config: {
            id: 'temp',
            name: 'Temp',
            provider: activeProvider.provider || 'ollama',
            baseUrl: activeProvider.baseUrl || '',
            apiKey: activeProvider.apiKey || '',
            model: activeProvider.model || '',
            compatibility: activeProvider.compatibility,
            enabledTools: {},
          },
          workspaceFolders: [],
        })
        .then((res: { requestId?: string }) => {
          const requestId = res.requestId
          if (!requestId) {
            resolve('')
            return
          }

          let summaryText = ''
          registerStreamHandler(requestId, (part: any) => {
            if (part.type === 'text-delta') {
              summaryText += part.text
            }
            if (part.type === 'finish') {
              unregisterStreamHandler(requestId)
              resolve(summaryText)
            }
            if (part.type === 'error') {
              unregisterStreamHandler(requestId)
              reject(new Error(String(part.error)))
            }
          })

          setTimeout(() => {
            unregisterStreamHandler(requestId)
            resolve(summaryText)
          }, 60000)
        })
        .catch(reject)
    })

    // Step 5: Build the compacted message list
    const systemOnly = systemMsg ? [systemMsg] : []
    const summaryAssistantMsg: UIMessage = {
      id: genId(),
      role: 'assistant',
      parts: [{ type: 'text', text: result, state: 'done' }],
    }
    const compactedMessages: UIMessage[] = [
      ...systemOnly,
      summaryAssistantMsg,
      ...afterLastUser,
    ]

    // Step 6: Update state and save
    session.state = {
      ...session.state,
      messages: compactedMessages,
    }
    session.lastSavedSnapshot = ''

    await aiMutations.saveSession(sessionId, compactedMessages, {
      summary: result,
    })

    // Notify listeners via updateState callback
    updateState({ messages: compactedMessages })
  } catch (err) {
    console.error('[ChatService] Compact context failed:', err)
  } finally {
    updateState({ compacting: false })
  }
}

/**
 * Check whether a session exceeds the auto-compact threshold.
 * Returns true if the estimated token count is above the threshold.
 */
export async function shouldAutoCompact(
  session: InternalSession,
): Promise<boolean> {
  if (!session.state.sessionId || session.state.messages.length === 0) {
    return false
  }
  try {
    const savedThreshold = await config.get('autoCompactThreshold')
    const tokenThreshold =
      typeof savedThreshold === 'number' && savedThreshold >= 200_000
        ? savedThreshold
        : 500_000
    const estimatedTokens = estimateTokenCount(session.state.messages)
    return estimatedTokens > tokenThreshold
  } catch {
    return false
  }
}
