/**
 * ChatService — Facade for AI Chat session management.
 *
 * Composes extracted services:
 *   - SessionStore: state Map, subscriptions, getOrCreate
 *   - AutoSaver: debounced save with 1s timer
 *   - CompactService: context compaction algorithm
 *   - StreamDispatcher: stream event routing
 *
 * Owns the orchestration: sendMessage, init, event wiring, and
 * simple pass-through operations (clearChat, handleApprove, etc.).
 */

import { AppEvents } from '../../../../lib/constants/app'
import type { AgentLoopConfig } from '../../../../lib/types/ai'
import type { InternalSession, SessionState } from '../../../../lib/types/chat'
import { createMessage } from '../../../../lib/types/chat'
import { ai as aiBridge, aiMutations } from '../../../bridge/ai'
import { config } from '../../../bridge/config'
import { workspace } from '../../../bridge/workspace'
import { runAgentLoop } from '../agent-loop'
import { executeCommandOnly } from '../utils/commands'
import {
  appendCommandOutput,
  appendPartToAssistant,
  appendReasoningToAssistant,
  appendToAssistant,
  appendToolInputDeltaToAssistant,
  updateToolResult,
} from '../utils/message'
import { scheduleSave } from './auto-saver'
import {
  compactContext as compactContextInner,
  shouldAutoCompact,
} from './compact-service'
import {
  getOrCreateSession,
  getSession,
  getState,
  hasSession,
  listAllSessions,
  notify,
  subscribe,
  updateState,
} from './session-store'
import {
  dispatchStreamEvent,
  registerStreamHandler,
  unregisterStreamHandler,
} from './stream-dispatcher'

// ─── Types ────────────────────────────────────────────────────────────────

type SubscribeFn = (cb: (event: any) => void) => () => void

// ─── Module-level state ───────────────────────────────────────────────────

let _subscribeToEvents: SubscribeFn | null = null
let initCalled = false

// Map of session IDs to their known date directories.
const sessionDates = new Map<string, string>()

// ─── Wrapper: updateState with auto-save ──────────────────────────────────

function updateStateAndSave(
  session: InternalSession,
  patch: Partial<SessionState>,
) {
  updateState(session, patch, scheduleSave)
}

// ─── Stream dispatch (wires event listener to StreamDispatcher) ───────────

function handleStreamDelta(requestId: string, part: any): void {
  dispatchStreamEvent(requestId, part)
}

// ─── Public API ───────────────────────────────────────────────────────────

// Re-exported from extracted services for backward compatibility
export {
  registerStreamHandler,
  unregisterStreamHandler,
} from './stream-dispatcher'
export { getState, hasSession, subscribe }

/**
 * Compact context for a session (legacy API — looks up session internally).
 * Kept for backward compatibility with useAIChat.ts.
 */
export async function compactContext(sessionId: string): Promise<void> {
  const session = getSession(sessionId)
  if (!session) return
  await compactContextInner(session, (patch) =>
    updateStateAndSave(session, patch as Partial<SessionState>),
  )
}

/**
 * Initialize the service with the event subscriber function.
 * Called once on first React mount — the listener persists for the app lifetime.
 * Safe to call multiple times (second call is a no-op).
 */
export function init(subscribeToApp: SubscribeFn) {
  if (initCalled) return
  initCalled = true
  _subscribeToEvents = subscribeToApp

  subscribeToApp((event: any) => {
    // Dispatch ai-chat-delta events to the correct active stream
    if (event.type === 'ai-chat-delta') {
      const { requestId, part } = event.data || {}
      if (requestId) handleStreamDelta(requestId, part)
      return
    }

    // Session changes — load from disk if not already in memory
    if (event.type === AppEvents.ACTIVE_SESSION_CHANGED) {
      const { id } = event.data as { id: string }
      if (id) {
        const existing = getSession(id)
        const isEmpty = existing && existing.state.messages.length === 0
        if (!existing || isEmpty) {
          loadSessionById(id).catch(() => {})
        }
      }
      return
    }

    // Approval requests
    if (event.type === AppEvents.AI_APPROVAL_REQUEST) {
      const { id, command, cwd } = event.data as any
      // Scan all active sessions for one in loading state
      const session = findLoadingSession()
      if (session) {
        const sid = session.state.sessionId
        if (
          sid &&
          typeof localStorage !== 'undefined' &&
          localStorage.getItem(`autoApprove:${sid}`) === 'true'
        ) {
          aiMutations.respondToAiApproval(id, true)
          return
        }
        session.approvalId = id
        updateStateAndSave(session, { pendingApproval: { command, cwd } })
      }
    }
  })
}

/**
 * Find the first session that is currently in loading state.
 * Used by the AI_APPROVAL_REQUEST event handler.
 */
function findLoadingSession(): InternalSession | undefined {
  for (const session of listAllSessions()) {
    if (session.state.loading) return session
  }
  return undefined
}

/**
 * Record the date directory for a session ID so subsequent loadSessionById
 * can avoid scanning all date directories.
 */
export function setPendingSessionDate(sessionId: string, date: string): void {
  sessionDates.set(sessionId, date)
}

/**
 * Load a session from disk into the service state.
 */
export async function loadSessionById(sessionId: string) {
  const date = sessionDates.get(sessionId)
  sessionDates.delete(sessionId)

  const res = await aiBridge.loadSession(sessionId, date)
  if (!res) {
    console.warn(
      `[ChatService] Session "${sessionId}" not found on disk${date ? ` (date: ${date})` : ''}.`,
    )
    return
  }

  const session = getOrCreateSession(sessionId)
  session.state = {
    ...session.state,
    messages: res,
    sessionId,
  }
  session.lastSavedSnapshot = JSON.stringify(res)
  notify(session)
}

/**
 * Create a new session file on disk and return its ID.
 */
export async function createNewSession(): Promise<string> {
  const newId = Date.now().toString()
  await aiMutations.saveSession(newId, [])
  return newId
}

/**
 * Send a message in a session, starting/continuing the agent loop.
 */
export async function sendMessage(
  sessionId: string,
  text: string,
  _activeFile?: string,
) {
  const session = getOrCreateSession(sessionId)
  if (!text.trim() || session.state.loading) return

  const [
    aiConfig,
    agentsConfig,
    toolsConfig,
    _promptsConfig,
    folders,
    activeFilePath,
    workspaceName,
  ] = await Promise.all([
    config.get('ai'),
    config.get('agents'),
    config.get('tools'),
    config.get('prompts'),
    workspace.folders(),
    _activeFile || config.get('activeFile'),
    config.get('activeWorkspace'),
  ])

  const workspaceFolders: string[] = folders || []

  const activeProvider =
    aiConfig?.providers?.find((p: any) => p.id === aiConfig.activeId) ||
    aiConfig?.providers?.[0]

  const activeAgent = agentsConfig?.list?.find(
    (a: any) => a.id === agentsConfig?.activeId,
  )

  // Use per-agent tools if available, otherwise fall back to global tools config
  const enabledTools = activeAgent?.tools || toolsConfig?.active || {}

  const agentConfig: AgentLoopConfig = {
    id: activeProvider?.id || 'chat',
    name: activeProvider?.name || 'Chat',
    provider: activeProvider?.provider || 'ollama',
    apiKey: activeProvider?.apiKey || '',
    baseUrl: activeProvider?.baseUrl || '',
    model: activeProvider?.model || '',
    compatibility: activeProvider?.compatibility,
    enabledTools,
    agentPromptFiles: activeAgent?.promptFiles || [],
  }

  const commandMentionRegex = />cmd\[(.*?)\]\((.*?)\)/g
  const skillMentionRegex = /\/skill\[(.*?)\]\((.*?)\)/g

  // Check if this is a command-only execution
  if (
    await executeCommandOnly(
      text,
      activeFilePath || '',
      session.state.messages,
      (msgs) => updateStateAndSave(session, { messages: msgs }),
      (loading) => updateStateAndSave(session, { loading }),
    )
  )
    return

  // Process embedded command mentions
  const commandMatches = [...text.matchAll(commandMentionRegex)]
  const commandResults: {
    name: string
    stdout: string
    stderr: string
    error?: string
  }[] = []

  if (commandMatches.length > 0) {
    updateStateAndSave(session, { loading: true })
    for (const match of commandMatches) {
      const [_full, name, path] = match
      try {
        const res = await aiMutations.runDirectCommand({
          commandPath: path,
          params: [],
          currentFile: activeFilePath || '',
        })
        commandResults.push({
          name,
          stdout: res.stdout || '',
          stderr: res.stderr || '',
        })
      } catch (e: unknown) {
        const errorMsg = e instanceof Error ? e.message : String(e)
        commandResults.push({
          name,
          stdout: '',
          stderr: errorMsg,
          error: errorMsg,
        })
      }
    }
    updateStateAndSave(session, { loading: false })
  }

  // Build command results text
  let resultsText = ''
  for (const res of commandResults) {
    const content = [res.stdout, res.stderr].filter(Boolean).join('\n').trim()
    const result =
      content || (res.error ? `Error: ${res.error}` : '(No output)')
    resultsText += `> Command: ${res.name}\n${result}\n\n---\n\n`
  }

  // Build initial messages with system prompt if needed
  const initialMessages = [...session.state.messages]
  if (initialMessages.length === 0) {
    const systemPrompt = await aiBridge.getMergedSystemPrompt(activeAgent?.id)
    if (systemPrompt) {
      initialMessages.push(
        createMessage('system', [{ type: 'text', text: systemPrompt }]),
      )
    }
  }

  const userText = resultsText
    ? `${text}\n\nI ran local commands, here are the results:\n\n${resultsText}`
    : text

  const userMsg = createMessage('user', [{ type: 'text', text: userText }])

  const updatedMessages = [...initialMessages, userMsg]
  updateStateAndSave(session, {
    messages: updatedMessages,
    loading: true,
    error: null,
  })

  const cleanText = text
    .replace(skillMentionRegex, '')
    .replace(commandMentionRegex, '')
    .trim()

  if (!cleanText && commandMatches.length > 0) {
    updateStateAndSave(session, { loading: false })
    return
  }

  const abort = new AbortController()
  session.abortController = abort

  try {
    const resultHistory = await runAgentLoop(
      updatedMessages,
      agentConfig,
      workspaceFolders,
      (event: any) => {
        updateStateAndSave(session, { currentStep: event })
        switch (event.type) {
          case 'text-delta':
            updateStateAndSave(session, {
              messages: appendToAssistant(session.state.messages, event.text),
            })
            break
          case 'reasoning-delta':
            updateStateAndSave(session, {
              messages: appendReasoningToAssistant(
                session.state.messages,
                event.text,
              ),
            })
            break
          case 'tool-input-delta':
            updateStateAndSave(session, {
              messages: appendToolInputDeltaToAssistant(
                session.state.messages,
                event.id,
                event.delta,
              ),
            })
            break
          case 'tool-call':
            updateStateAndSave(session, {
              messages: appendPartToAssistant(session.state.messages, {
                toolCallId: event.toolCallId,
                toolName: event.toolName,
                input: event.input,
              }),
            })
            break
          case 'tool-result':
            updateStateAndSave(session, {
              messages: updateToolResult(session.state.messages, {
                toolCallId: event.toolCallId,
                toolName: event.toolName,
                output: event.output,
              }),
            })
            break
          case 'command-output':
            updateStateAndSave(session, {
              messages: appendCommandOutput(
                session.state.messages,
                (event as any).text,
              ),
            })
            break
          case 'error': {
            const errMsg = String(event.error)
            const isProviderError =
              errMsg.includes('fetch failed') ||
              errMsg.includes('401') ||
              errMsg.includes('invalid_api_key') ||
              errMsg.includes('API key') ||
              errMsg.includes('timeout') ||
              errMsg.includes('aborted') ||
              errMsg.includes('ECONNREFUSED') ||
              errMsg.includes('ENOTFOUND')
            updateStateAndSave(session, {
              error: {
                message: errMsg,
                redacted: isProviderError
                  ? errMsg.includes('fetch failed') ||
                    errMsg.includes('ECONNREFUSED') ||
                    errMsg.includes('ENOTFOUND')
                    ? 'Connection failed. Please check if your AI provider service is running.'
                    : errMsg.includes('401') ||
                        errMsg.includes('invalid_api_key') ||
                        errMsg.includes('API key')
                      ? 'Authentication failed. Please check your API key.'
                      : 'A system error occurred. Please check your configuration and try again.'
                  : errMsg,
                type: isProviderError ? 'provider' : 'tool',
              },
            })
            break
          }
          case 'finish':
            updateStateAndSave(session, { currentStep: null })
            break
        }
      },
      activeFilePath || '',
      abort.signal,
      (requestId, handler) => {
        registerStreamHandler(requestId, handler)
        return () => unregisterStreamHandler(requestId)
      },
      workspaceName,
    )
    updateStateAndSave(session, { messages: resultHistory })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    const isProviderError =
      msg.includes('fetch failed') ||
      msg.includes('401') ||
      msg.includes('invalid_api_key') ||
      msg.includes('API key') ||
      msg.includes('timeout') ||
      msg.includes('aborted') ||
      msg.includes('ECONNREFUSED') ||
      msg.includes('ENOTFOUND')
    updateStateAndSave(session, {
      error: {
        message: msg,
        redacted: isProviderError
          ? msg.includes('fetch failed') ||
            msg.includes('ECONNREFUSED') ||
            msg.includes('ENOTFOUND')
            ? 'Connection failed. Please check if your AI provider service is running.'
            : msg.includes('401') ||
                msg.includes('invalid_api_key') ||
                msg.includes('API key')
              ? 'Authentication failed. Please check your API key.'
              : 'A system error occurred. Please check your configuration and try again.'
          : msg,
        type: isProviderError ? 'provider' : 'system',
      },
    })
  } finally {
    updateStateAndSave(session, { loading: false, currentStep: null })
    session.abortController = null

    // Check if auto-compact is needed
    if (session.state.sessionId && session.state.messages.length > 0) {
      const shouldCompact = await shouldAutoCompact(session)
      if (shouldCompact) {
        compactContextInner(session, (patch) =>
          updateStateAndSave(session, patch as Partial<SessionState>),
        ).catch((err) =>
          console.error('[ChatService] Auto-compact failed:', err),
        )
      }
    }
  }
}

/**
 * Clear chat for a session — resets state and aborts any running agent.
 */
export function clearChat(sessionId: string) {
  const session = getSession(sessionId)
  if (session) {
    session.abortController?.abort()
    session.abortController = null
    session.approvalId = null
    session.lastSavedSnapshot = ''
    if (session.saveTimer) clearTimeout(session.saveTimer)
    session.saveTimer = null
    updateStateAndSave(session, {
      messages: [],
      loading: false,
      error: null,
      currentStep: null,
      pendingApproval: null,
      sessionId: session.state.sessionId,
    })
  }
}

/**
 * Handle approve action for pending approval.
 */
export function handleApprove(sessionId: string) {
  const session = getSession(sessionId)
  if (session?.approvalId) {
    aiMutations.respondToAiApproval(session.approvalId, true)
    session.approvalId = null
  }
  if (session) {
    updateStateAndSave(session, { pendingApproval: null })
  }
}

/**
 * Handle reject action for pending approval.
 */
export function handleReject(sessionId: string) {
  const session = getSession(sessionId)
  if (session?.approvalId) {
    aiMutations.respondToAiApproval(session.approvalId, false)
    session.approvalId = null
  }
  if (session) {
    updateStateAndSave(session, { pendingApproval: null })
  }
}

/**
 * Revert messages to a specific index.
 */
export function revertToMessage(sessionId: string, index: number) {
  const session = getSession(sessionId)
  if (!session) return
  const prev = session.state.messages
  if (index < 0 || index >= prev.length) return
  updateStateAndSave(session, { messages: prev.slice(0, index + 1) })
}

/**
 * Abort the currently running message in a session.
 */
export function abortMessage(sessionId: string) {
  const session = getSession(sessionId)
  session?.abortController?.abort()
}

/**
 * Clear the error state for a session.
 */
export function clearError(sessionId: string) {
  const session = getSession(sessionId)
  if (session) updateStateAndSave(session, { error: null })
}
