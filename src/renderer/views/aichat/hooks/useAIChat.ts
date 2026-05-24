/**
 * useAIChat — Thin React wrapper around ChatService.
 *
 * Owns only UI-level state (settings, workspace folders, artifact status, input ref).
 * All agent loop state (messages, loading, error, approvals) lives in ChatService
 * and survives component unmounts/remounts.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { AppEvents } from '../../../../lib/constants/app'
import { DEFAULT_SETTINGS } from '../../../../lib/constants/settings'
import type { SessionState } from '../../../../lib/types/chat'
import type { SettingsState } from '../../../shared/lib/types'
import { useAppEventSubscriber } from '../../../views/ViewContext'
import type { ChatInputHandle } from '../components/InputEditor'
import * as ChatService from '../services/ChatService'

export function useAIChat() {
  const subscribeToAppEvents = useAppEventSubscriber()

  // ── UI-level state (not agent-loop related) ──
  const [settings, setSettings] = useState<SettingsState>(
    DEFAULT_SETTINGS as SettingsState,
  )
  const [workspaceFolders, setWorkspaceFolders] = useState<string[]>([])
  const [activeTabPath, setActiveTabPath] = useState<string>('')
  const inputRef = useRef<ChatInputHandle>(null)

  const [artifactStatus, setArtifactStatus] = useState<{
    memory: { exists: boolean; path: string }
    task: { exists: boolean; path: string }
    plan: { exists: boolean; path: string }
  } | null>(null)

  // ── Session tracking ──
  // Which sessionId is this component currently showing
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  // State from ChatService (subscribed)
  const [sessionState, setSessionState] = useState<SessionState>({
    sessionId: null,
    messages: [],
    loading: false,
    error: null,
    currentStep: null,
    pendingApproval: null,
  })

  // ── Init ChatService on first mount ──
  useEffect(() => {
    ChatService.init(subscribeToAppEvents)
  }, [subscribeToAppEvents])

  // ── Subscribe to the active session's state changes ──
  useEffect(() => {
    if (!activeSessionId) return
    return ChatService.subscribe(activeSessionId, (state) => {
      setSessionState(state)
    })
  }, [activeSessionId])

  // ── Load initial session on mount ──
  useEffect(() => {
    const loadInitial = async () => {
      const id = await window.aynite.getConfig('activeSessionId')
      if (id) {
        setActiveSessionId(id)
        await ChatService.loadSessionById(id)
      }
    }
    loadInitial()
  }, [])

  // ── Load settings & workspace ──
  const loadSettings = useCallback(async () => {
    try {
      const [resAI, resAgents, resTools, resPrompts] = await Promise.all([
        window.aynite.getConfig('ai'),
        window.aynite.getConfig('agents'),
        window.aynite.getConfig('tools'),
        window.aynite.getConfig('prompts'),
      ])
      setSettings((prev) => ({
        ...prev,
        ai: resAI || prev.ai,
        agents: resAgents || prev.agents,
        aiTools: resTools?.active || prev.aiTools,
        prompts: resPrompts || prev.prompts,
      }))
    } catch (_e) {}
  }, [])

  const loadWorkspaceFolders = useCallback(async () => {
    const folders = await window.aynite.getWorkspaceFolders()
    if (folders) setWorkspaceFolders(folders)
  }, [])

  const loadArtifactStatus = useCallback(async () => {
    const status = await window.aynite.getArtifactsStatus()
    setArtifactStatus(status)
  }, [])

  useEffect(() => {
    loadSettings()
    loadWorkspaceFolders()
    loadArtifactStatus()
  }, [loadSettings, loadWorkspaceFolders, loadArtifactStatus])

  // ── Non-agent-loop event handlers (stay in React) ──
  useEffect(() => {
    const _unsubscribe = subscribeToAppEvents((event: any) => {
      if (event.type === 'config-changed') loadSettings()
      if (event.type === 'workspace-changed') loadWorkspaceFolders()
      if (event.type === 'active-tab-changed') setActiveTabPath(event.data.path)
      if (event.type === AppEvents.ACTIVE_SESSION_CHANGED) {
        const { id } = event.data as { id: string }
        if (id) {
          setActiveSessionId(id)
          // Only load from disk if not already in memory — otherwise the
          // disk data might be stale (empty for a newly created session,
          // or outdated for a session that was modified in-memory).
          // This mirrors ChatService's own !sessions.has(id) guard.
          if (!ChatService.hasSession(id)) {
            ChatService.loadSessionById(id).catch(() => {})
          }
        }
      }
    })
  }, [subscribeToAppEvents, loadSettings, loadWorkspaceFolders])

  // ── Actions (delegate to ChatService) ──

  const sendMessage = useCallback(
    async (text: string) => {
      // Step 1: Use the local session ID directly. This tile is showing this
      // session — the message MUST go here. Config is NOT used for routing;
      // it's only read for the initial load (see loadInitial).
      //
      // In multi-tile mode, each tile has its own activeSessionId, so they
      // are completely independent.
      let sid = activeSessionId

      // Step 2: If no session is loaded (e.g., cleared by new chat), create one.
      if (!sid) {
        sid = await ChatService.createNewSession()
      }

      // Step 3: Persist this session ID for the next app start (fire-and-forget).
      // In multi-tile, this would save to the tile's data instead of global config.
      window.aynite.setConfig('activeSessionId', sid).catch(() => {})

      setActiveSessionId(sid)
      await ChatService.sendMessage(sid, text, activeTabPath)
    },
    [activeSessionId, activeTabPath],
  )

  const clearChat = useCallback(() => {
    if (activeSessionId) {
      ChatService.clearChat(activeSessionId)
    }
    setActiveSessionId(null)
    // NOTE: No config write here. This is a tile-local operation.
    // In multi-tile mode, clearing one tile's session should not affect
    // other tiles (which would react to the global ACTIVE_SESSION_CHANGED event).
    // The session ID in config will be overwritten when the user sends their
    // first message in the new session (see sendMessage's fire-and-forget write).
  }, [activeSessionId])

  const handleApprove = useCallback(() => {
    if (activeSessionId) ChatService.handleApprove(activeSessionId)
  }, [activeSessionId])

  const handleReject = useCallback(() => {
    if (activeSessionId) ChatService.handleReject(activeSessionId)
  }, [activeSessionId])

  const revertToMessage = useCallback(
    (index: number) => {
      if (activeSessionId) ChatService.revertToMessage(activeSessionId, index)
    },
    [activeSessionId],
  )

  // ── Other actions (stay in React) ──

  const loadSessions = useCallback(async () => {
    const res = await window.aynite.listSessions()
    return res || []
  }, [])

  const copyToClipboard = useCallback((text: string) => {
    window.aynite
      .writeClipboard(text)
      .catch((err) => console.error('[useAIChat] Failed to copy', err))
  }, [])

  const switchAgent = useCallback(async (agentId: string) => {
    await window.aynite.setConfig('agents', { activeId: agentId })
  }, [])

  const switchProvider = useCallback(
    async (providerId: string) => {
      await window.aynite.setConfig('ai', { activeId: providerId })
      loadArtifactStatus()
    },
    [loadArtifactStatus],
  )

  // ── Derived state ──

  const abortRef = useRef<{ abort: () => void } | null>(null)
  // Provide actual abort functionality
  abortRef.current = activeSessionId
    ? { abort: () => ChatService.abortMessage(activeSessionId) }
    : null

  const _setError = useCallback(
    (err: { message: string; redacted: string } | null) => {
      if (activeSessionId) {
        if (err === null) {
          ChatService.clearError(activeSessionId)
        }
      }
    },
    [activeSessionId],
  )

  const tokenCount = sessionState.messages.reduce((acc, m) => {
    const textLength = m.parts.reduce((len, p) => {
      switch (p.type) {
        case 'text':
          return len + p.text.length
        case 'reasoning':
          return len + p.text.length
        case 'dynamic-tool': {
          let inputLen = 0
          let outputLen = 0
          if (p.input) {
            inputLen =
              typeof p.input === 'string'
                ? p.input.length
                : JSON.stringify(p.input).length
          }
          if (p.output) {
            outputLen =
              typeof p.output === 'string'
                ? p.output.length
                : JSON.stringify(p.output).length
          }
          return len + inputLen + outputLen
        }
        default:
          return len
      }
    }, 0)
    return acc + Math.ceil((textLength / 4) * 1.1)
  }, 0)

  return {
    // From settings
    settings,
    workspaceFolders,

    // From ChatService (session state)
    messages: sessionState.messages,
    loading: sessionState.loading,
    currentStep: sessionState.currentStep,
    pendingApproval: sessionState.pendingApproval,
    error: sessionState.error,
    setError: (_err: { message: string; redacted: string } | null) => {
      // local error override if needed (user dismissing)
    },

    // Refs
    inputRef,
    abortRef,

    // Artifact status
    artifactStatus,
    loadArtifactStatus,
    tokenCount,

    // Actions
    sendMessage,
    clearChat,
    handleApprove,
    handleReject,
    loadSessions,
    copyToClipboard,
    revertToMessage,
    switchAgent,
    switchProvider,
  }
}
