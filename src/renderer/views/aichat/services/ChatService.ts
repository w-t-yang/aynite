/**
 * ChatService — Module-level singleton for AI Chat sessions.
 *
 * Owns all session state (messages, loading, error, approvals) and the agent loop lifecycle.
 * Survives React component mounts/unmounts — state persists across view switches.
 *
 * React components subscribe to session changes and delegate actions here.
 * The service uses the `subscribe` bridge from ViewContext (useAppEventSubscriber)
 * to listen to main process events, avoiding direct window.message usage.
 *
 * For streaming: maintains a map of requestId → handler so the single permanent
 * listener can dispatch ai-chat-delta events to the correct active stream.
 */

import type { UIMessage } from 'ai'
import { AppEvents } from '../../../../lib/constants/app'
import type { AgentLoopConfig } from '../../../../lib/types/ai'
import type { SessionState } from '../../../../lib/types/chat'
import { runAgentLoop } from '../utils/agent'
import { executeCommandOnly } from '../utils/commands'
import {
  appendCommandOutput,
  appendPartToAssistant,
  appendReasoningToAssistant,
  appendToAssistant,
  appendToolInputDeltaToAssistant,
  genId,
  updateToolResult,
} from '../utils/message'

// ─── Types ────────────────────────────────────────────────────────────────

interface InternalSession {
  state: SessionState
  abortController: AbortController | null
  approvalId: string | null
  lastSavedSnapshot: string
  listeners: Set<(state: SessionState) => void>
  saveTimer: ReturnType<typeof setTimeout> | null
}

type SubscribeFn = (cb: (event: any) => void) => () => void

// ─── Module-level state ───────────────────────────────────────────────────

const sessions = new Map<string, InternalSession>()
const activeStreams = new Map<string, (part: any) => void>()
let _subscribeToEvents: SubscribeFn | null = null
let initCalled = false

// ─── Helpers ──────────────────────────────────────────────────────────────

function notify(session: InternalSession) {
  const state = { ...session.state }
  for (const listener of session.listeners) {
    try {
      listener(state)
    } catch {
      // ignore stale listeners
    }
  }
}

function updateState(session: InternalSession, patch: Partial<SessionState>) {
  session.state = { ...session.state, ...patch }
  scheduleSave(session)
  notify(session)
}

// ─── Auto-save ────────────────────────────────────────────────────────────

function scheduleSave(session: InternalSession) {
  const sid = session.state.sessionId
  if (!sid || session.state.messages.length === 0) return

  // Skip save if messages haven't changed since last save
  const snapshot = JSON.stringify(session.state.messages)
  if (snapshot === session.lastSavedSnapshot) return

  if (session.saveTimer) clearTimeout(session.saveTimer)
  session.saveTimer = setTimeout(async () => {
    try {
      // Guard: messages may have been cleared by clearChat() while the timer
      // callback was queued or during an await below. Don't overwrite disk
      // data with an empty array.
      if (session.state.messages.length === 0) return

      const aiConfig = await window.aynite.getConfig('ai')
      const agentsConfig = await window.aynite.getConfig('agents')

      // Guard again after async IPC — clearChat() may have run during the await
      if (session.state.messages.length === 0) return

      const activeProvider =
        aiConfig?.providers?.find((p: any) => p.id === aiConfig.activeId) ||
        aiConfig?.providers?.[0]
      const activeAgent = agentsConfig?.list?.find(
        (a: any) => a.id === agentsConfig?.activeId,
      )
      const metadata = {
        agentName: activeAgent?.name || 'Chat',
        modelName: activeProvider?.name || activeProvider?.model || 'AI',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      await window.aynite.saveSession(sid, session.state.messages, metadata)
      session.lastSavedSnapshot = snapshot
    } catch {
      // silent
    }
  }, 1000)
}

// ─── Stream dispatch ──────────────────────────────────────────────────────

/**
 * Register a handler for a specific stream requestId.
 * Used by runAgentLoop instead of creating per-call window.message listeners.
 */
export function registerStreamHandler(
  requestId: string,
  handler: (part: any) => void,
): void {
  activeStreams.set(requestId, handler)
}

/**
 * Unregister a stream handler when the stream finishes/aborts.
 */
export function unregisterStreamHandler(requestId: string): void {
  activeStreams.delete(requestId)
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Initialize the service with the event subscriber function.
 * Called once on first React mount — the listener persists for the app lifetime.
 * Safe to call multiple times (second call is a no-op).
 */
export function init(subscribe: SubscribeFn) {
  if (initCalled) return
  initCalled = true
  _subscribeToEvents = subscribe

  // ── Permanent single listener for all app events ──
  subscribe((event: any) => {
    // Dispatch ai-chat-delta events to the correct active stream
    if (event.type === 'ai-chat-delta') {
      const { requestId, part } = event.data || {}
      const handler = requestId ? activeStreams.get(requestId) : null
      if (handler) handler(part)
      return
    }

    // Session changes — load from disk only if not already in memory.
    // The sessions.has() guard prevents overwriting in-memory state
    // that may have been modified by sendMessage before this async event
    // was processed. The file always exists because createNewSession
    // writes it before setting the config.
    if (event.type === AppEvents.ACTIVE_SESSION_CHANGED) {
      const { id } = event.data as { id: string }
      if (id && !sessions.has(id)) {
        loadSessionById(id).catch(() => {})
      }
      return
    }

    // Approval requests — find the loading session and set pending state
    if (event.type === AppEvents.AI_APPROVAL_REQUEST) {
      const { id, command, cwd } = event.data as any
      for (const [, session] of sessions) {
        if (session.state.loading) {
          session.approvalId = id
          updateState(session, { pendingApproval: { command, cwd } })
          break
        }
      }
    }
  })
}

/**
 * Get or create a session state container.
 */
export function getOrCreateSession(sessionId: string): InternalSession {
  let session = sessions.get(sessionId)
  if (!session) {
    session = {
      state: {
        sessionId,
        messages: [],
        loading: false,
        error: null,
        currentStep: null,
        pendingApproval: null,
      },
      abortController: null,
      approvalId: null,
      lastSavedSnapshot: '',
      listeners: new Set(),
      saveTimer: null,
    }
    sessions.set(sessionId, session)
  }
  return session
}

/**
 * Subscribe to state changes for a given session.
 * Returns an unsubscribe function.
 */
export function subscribe(
  sessionId: string,
  callback: (state: SessionState) => void,
): () => void {
  const session = getOrCreateSession(sessionId)
  session.listeners.add(callback)
  // Immediately call with current state
  callback({ ...session.state })
  return () => {
    session.listeners.delete(callback)
  }
}

/**
 * Load a session from disk into the service state.
 */
export async function loadSessionById(sessionId: string) {
  const res = await window.aynite.loadSession(sessionId)
  if (!res) return

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
 * Does NOT write to global config — the caller (useAIChat) is responsible
 * for managing the session ID locally. This makes ChatService tile-agnostic:
 * each AI Chat tile can create sessions independently without conflicting.
 *
 * To persist the session for the next app start, the caller should save
 * the session ID to config (or tile data) separately.
 */
export async function createNewSession(): Promise<string> {
  const newId = Date.now().toString()
  await window.aynite.saveSession(newId, [])
  return newId
}

/**
 * Send a message in a session, starting/continuing the agent loop.
 * Sessions are created lazily on first message.
 */
export async function sendMessage(
  sessionId: string,
  text: string,
  _activeFile?: string,
) {
  const session = getOrCreateSession(sessionId)
  if (!text.trim() || session.state.loading) return

  // Fetch config directly via IPC — no React dependency.
  const [
    aiConfig,
    agentsConfig,
    toolsConfig,
    promptsConfig,
    folders,
    activeFilePath,
  ] = await Promise.all([
    window.aynite.getConfig('ai'),
    window.aynite.getConfig('agents'),
    window.aynite.getConfig('tools'),
    window.aynite.getConfig('prompts'),
    window.aynite.getWorkspaceFolders(),
    _activeFile || window.aynite.getConfig('activeFile'),
  ])

  const workspaceFolders: string[] = folders || []

  const activeProvider =
    aiConfig?.providers?.find((p: any) => p.id === aiConfig.activeId) ||
    aiConfig?.providers?.[0]

  const activeAgent = agentsConfig?.list?.find(
    (a: any) => a.id === agentsConfig?.activeId,
  )

  const agentConfig: AgentLoopConfig = {
    id: activeProvider?.id || 'chat',
    name: activeProvider?.name || 'Chat',
    provider: activeProvider?.provider || 'ollama',
    apiKey: activeProvider?.apiKey || '',
    baseUrl: activeProvider?.baseUrl || '',
    model: activeProvider?.model || '',
    compatibility: activeProvider?.compatibility,
    enabledTools: toolsConfig?.active || {},
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
      (msgs) => updateState(session, { messages: msgs }),
      (loading) => updateState(session, { loading }),
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
    updateState(session, { loading: true })
    for (const match of commandMatches) {
      const [_full, name, path] = match
      try {
        const res = await window.aynite.runDirectCommand({
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
    updateState(session, { loading: false })
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
    const globalPromptFiles = promptsConfig?.files || []
    const systemPrompt = await window.aynite.getMergedSystemPrompt(
      globalPromptFiles,
      activeAgent?.promptFiles || [],
    )
    if (systemPrompt) {
      initialMessages.push({
        id: genId(),
        role: 'system',
        parts: [{ type: 'text', text: systemPrompt }],
      })
    }
  }

  // Create user message
  const userText = resultsText
    ? `${text}\n\nI ran local commands, here are the results:\n\n${resultsText}`
    : text

  const userMsg: UIMessage = {
    id: genId(),
    role: 'user',
    parts: [{ type: 'text', text: userText }],
  }

  const updatedMessages = [...initialMessages, userMsg]
  updateState(session, {
    messages: updatedMessages,
    loading: true,
    error: null,
  })

  const cleanText = text
    .replace(skillMentionRegex, '')
    .replace(commandMentionRegex, '')
    .trim()

  if (!cleanText && commandMatches.length > 0) {
    updateState(session, { loading: false })
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
        updateState(session, { currentStep: event })
        switch (event.type) {
          case 'text-delta':
            updateState(session, {
              messages: appendToAssistant(session.state.messages, event.text),
            })
            break
          case 'reasoning-delta':
            updateState(session, {
              messages: appendReasoningToAssistant(
                session.state.messages,
                event.text,
              ),
            })
            break
          case 'tool-input-delta':
            updateState(session, {
              messages: appendToolInputDeltaToAssistant(
                session.state.messages,
                event.id,
                event.delta,
              ),
            })
            break
          case 'tool-call':
            updateState(session, {
              messages: appendPartToAssistant(session.state.messages, {
                toolCallId: event.toolCallId,
                toolName: event.toolName,
                input: event.input,
              }),
            })
            break
          case 'tool-result':
            updateState(session, {
              messages: updateToolResult(session.state.messages, {
                toolCallId: event.toolCallId,
                toolName: event.toolName,
                output: event.output,
              }),
            })
            break
          case 'command-output':
            updateState(session, {
              messages: appendCommandOutput(
                session.state.messages,
                (event as any).text,
              ),
            })
            break
          case 'error':
            updateState(session, {
              error: {
                message: String(event.error),
                redacted: String(event.error).includes('fetch failed')
                  ? 'Connection failed. Please check if your AI provider service is running.'
                  : String(event.error).includes('401') ||
                      String(event.error).includes('invalid_api_key')
                    ? 'Authentication failed. Please check your API key.'
                    : 'An error occurred while communicating with the AI provider.',
              },
            })
            break
          case 'finish':
            updateState(session, { currentStep: null })
            break
        }
      },
      activeFilePath || '',
      abort.signal,
      (requestId, handler) => {
        registerStreamHandler(requestId, handler)
        return () => unregisterStreamHandler(requestId)
      },
    )
    updateState(session, { messages: resultHistory })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    updateState(session, {
      error: {
        message: msg,
        redacted:
          'A system error occurred. Please check your configuration and try again.',
      },
    })
  } finally {
    updateState(session, { loading: false, currentStep: null })
    session.abortController = null
  }
}

/**
 * Clear chat for a session — resets state and aborts any running agent.
 */
export function clearChat(sessionId: string) {
  const session = sessions.get(sessionId)
  if (session) {
    session.abortController?.abort()
    session.abortController = null
    session.approvalId = null
    session.lastSavedSnapshot = ''
    if (session.saveTimer) clearTimeout(session.saveTimer)
    session.saveTimer = null
    updateState(session, {
      messages: [],
      loading: false,
      error: null,
      currentStep: null,
      pendingApproval: null,
      sessionId: session.state.sessionId, // preserve session ID for metadata
    })
  }
}

/**
 * Handle approve action for pending approval.
 */
export function handleApprove(sessionId: string) {
  const session = sessions.get(sessionId)
  if (session?.approvalId) {
    window.aynite.respondToAiApproval(session.approvalId, true)
    session.approvalId = null
  }
  if (session) {
    updateState(session, { pendingApproval: null })
  }
}

/**
 * Handle reject action for pending approval.
 */
export function handleReject(sessionId: string) {
  const session = sessions.get(sessionId)
  if (session?.approvalId) {
    window.aynite.respondToAiApproval(session.approvalId, false)
    session.approvalId = null
  }
  if (session) {
    updateState(session, { pendingApproval: null })
  }
}

/**
 * Revert messages to a specific index.
 */
export function revertToMessage(sessionId: string, index: number) {
  const session = sessions.get(sessionId)
  if (!session) return
  const prev = session.state.messages
  if (index < 0 || index >= prev.length) return
  updateState(session, { messages: prev.slice(0, index + 1) })
}

/**
 * Abort the currently running message in a session.
 */
export function abortMessage(sessionId: string) {
  const session = sessions.get(sessionId)
  session?.abortController?.abort()
}

/**
 * Clear the error state for a session.
 */
export function clearError(sessionId: string) {
  const session = sessions.get(sessionId)
  if (session) updateState(session, { error: null })
}

/**
 * Get the current state for a session (synchronous, for React renders).
 */
export function getState(sessionId: string): SessionState | undefined {
  return sessions.get(sessionId)?.state
}

/**
 * Check if a session exists.
 */
export function hasSession(sessionId: string): boolean {
  return sessions.has(sessionId)
}
