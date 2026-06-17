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
import { ai as aiBridge } from '../../../bridge/ai'
import { config, configMutations } from '../../../bridge/config'
import { utils } from '../../../bridge/utils'
import { workspace } from '../../../bridge/workspace'
import type { SettingsState } from '../../../shared/lib/types'
import { useViewEventSubscriber } from '../../useViewEvents'
import type { ChatInputHandle } from '../components/InputEditor'
import * as ChatService from '../services/ChatService'
import { estimateTokenCount } from '../utils/message'

export function useAIChat() {
  const subscribeToAppEvents = useViewEventSubscriber()

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

  // ── Auto-compact threshold ──
  const [autoCompactThreshold, setAutoCompactThresholdState] =
    useState<number>(500_000)

  const setAutoCompactThreshold = useCallback((value: number) => {
    const valid =
      Number.isFinite(value) && value >= 200_000 && value <= 800_000
        ? value
        : 500_000
    setAutoCompactThresholdState(valid)
    // Save to main config (config.json) via static handler
    configMutations.set('autoCompactThreshold', valid).catch(() => {})
  }, [])

  // ── Session tracking ──
  // Which sessionId is this component currently showing
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  // State from ChatService (subscribed)
  const [sessionState, setSessionState] = useState<SessionState>({
    sessionId: null,
    messages: [],
    loading: false,
    compacting: false,
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

  // ── Load initial session & threshold on mount ──
  useEffect(() => {
    const loadInitial = async () => {
      const id = await config.get('activeSessionId')
      if (id) {
        setActiveSessionId(id)
        await ChatService.loadSessionById(id)
      }
      // Load threshold from main config (config.json)
      const savedThreshold = await config.get('autoCompactThreshold')
      if (typeof savedThreshold === 'number' && savedThreshold >= 200_000) {
        setAutoCompactThresholdState(savedThreshold)
      }
    }
    loadInitial()
  }, [])

  // ── Load settings & workspace ──
  const loadSettings = useCallback(async () => {
    try {
      const [resAI, resAgents, resTools, resPrompts] = await Promise.all([
        config.get('ai'),
        config.get('agents'),
        config.get('tools'),
        config.get('prompts'),
      ])
      setSettings((prev) => ({
        ...prev,
        ai: (resAI as SettingsState['ai']) || prev.ai,
        agents: (resAgents as SettingsState['agents']) || prev.agents,
        aiTools: (resTools as any)?.active || prev.aiTools,
        prompts: (resPrompts as SettingsState['prompts']) || prev.prompts,
      }))
    } catch (_e) {}
  }, [])

  const loadWorkspaceFolders = useCallback(async () => {
    const folders = await workspace.folders()
    if (folders) setWorkspaceFolders(folders)
  }, [])

  const loadArtifactStatus = useCallback(async () => {
    const status = await aiBridge.getArtifactsStatus()
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
      // ACTIVE_SESSION_CHANGED is handled by ChatService (loads from disk).
      // This hook only updates the local activeSessionId for subscription.
      if (event.type === AppEvents.ACTIVE_SESSION_CHANGED) {
        const { id } = event.data as { id: string }
        if (id) {
          setActiveSessionId(id)
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
      configMutations.set('activeSessionId', sid).catch(() => {})

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

  const compactContext = useCallback(async () => {
    if (activeSessionId) {
      await ChatService.compactContext(activeSessionId)
    }
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
    const res = await aiBridge.listSessions()
    return res || []
  }, [])

  const copyToClipboard = useCallback((text: string) => {
    utils
      .writeClipboard(text)
      .catch((err) => console.error('[useAIChat] Failed to copy', err))
  }, [])

  const switchAgent = useCallback(async (agentId: string) => {
    await configMutations.set('agents', { activeId: agentId } as any)
  }, [])

  const switchProvider = useCallback(
    async (providerId: string) => {
      await configMutations.set('ai', { activeId: providerId } as any)
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
    (err: { message: string; redacted: string; type?: string } | null) => {
      if (activeSessionId) {
        if (err === null) {
          ChatService.clearError(activeSessionId)
        }
      }
    },
    [activeSessionId],
  )

  const tokenCount = estimateTokenCount(sessionState.messages)

  return {
    // From settings
    settings,
    workspaceFolders,

    // From ChatService (session state)
    messages: sessionState.messages,
    loading: sessionState.loading,
    compacting: sessionState.compacting,
    currentStep: sessionState.currentStep,
    pendingApproval: sessionState.pendingApproval,
    error: sessionState.error,
    setError: _setError,

    // Refs
    inputRef,
    abortRef,

    // Session ID
    activeSessionId,

    // Artifact status
    artifactStatus,
    loadArtifactStatus,
    tokenCount,

    autoCompactThreshold,
    setAutoCompactThreshold,

    // Actions
    sendMessage,
    clearChat,
    compactContext,
    handleApprove,
    handleReject,
    loadSessions,
    copyToClipboard,
    revertToMessage,
    switchAgent,
    switchProvider,
  }
}
