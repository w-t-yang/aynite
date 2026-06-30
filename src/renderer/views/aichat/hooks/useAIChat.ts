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

  // ── Reasoning effort ──
  const [reasoningEffort, setReasoningEffortState] = useState<string>('off')

  const setReasoningEffort = useCallback(async (effort: string) => {
    setReasoningEffortState(effort)
    const aiConfig = await config.get('ai')
    if (aiConfig?.providers && aiConfig.activeId) {
      const updatedProviders = aiConfig.providers.map((p: any) => {
        if (p.id === aiConfig.activeId) {
          return { ...p, reasoningEffort: effort }
        }
        return p
      })
      await configMutations.set('ai', {
        ...aiConfig,
        providers: updatedProviders,
      })
    }
  }, [])

  // ── Auto-approve per session ──
  const [autoApprove, setAutoApprove] = useState(false)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)

  const setAutoApproveForSession = useCallback(
    (enabled: boolean) => {
      setAutoApprove(enabled)
      if (activeSessionId) {
        if (enabled) {
          localStorage.setItem(`autoApprove:${activeSessionId}`, 'true')
        } else {
          localStorage.removeItem(`autoApprove:${activeSessionId}`)
        }
      }
    },
    [activeSessionId],
  )

  // ── Active project folder ──
  const [activeProjectFolder, setActiveProjectFolderState] = useState<
    string | null
  >(null)

  const setActiveProjectFolder = useCallback(async (folder: string) => {
    setActiveProjectFolderState(folder)
    await configMutations.set('activeProjectFolder', folder)
  }, [])

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
        // Load auto-approve state from localStorage
        const stored = localStorage.getItem(`autoApprove:${id}`)
        if (stored === 'true') {
          setAutoApprove(true)
        }
        await ChatService.loadSessionById(id)
      }
      // Load threshold from main config (config.json)
      const savedThreshold = await config.get('autoCompactThreshold')
      if (typeof savedThreshold === 'number' && savedThreshold >= 200_000) {
        setAutoCompactThresholdState(savedThreshold)
      }
      // Load active project folder
      const savedFolder = await config.get('activeProjectFolder')
      if (savedFolder) {
        setActiveProjectFolderState(savedFolder)
      }
    }
    loadInitial()
  }, [])

  // ── Sync auto-approve when session ID changes ──
  useEffect(() => {
    if (activeSessionId) {
      const stored = localStorage.getItem(`autoApprove:${activeSessionId}`)
      setAutoApprove(stored === 'true')
    }
  }, [activeSessionId])

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
      // Sync reasoning effort from active provider
      if (resAI?.providers && resAI.activeId) {
        const active = resAI.providers.find((p: any) => p.id === resAI.activeId)
        if (active?.reasoningEffort) {
          setReasoningEffortState(active.reasoningEffort)
        }
      }
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
      let sid = activeSessionId

      if (!sid) {
        sid = await ChatService.createNewSession()
      }

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
    setSettings((prev) => {
      if (!prev.agents) return prev
      return {
        ...prev,
        agents: {
          activeId: agentId,
          list: prev.agents.list || [],
        },
      }
    })
  }, [])

  const switchProvider = useCallback(
    async (providerId: string) => {
      await configMutations.set('ai', { activeId: providerId } as any)
      loadArtifactStatus()
      // Sync reasoning effort for the new provider
      const aiConfig = await config.get('ai')
      if (aiConfig?.providers) {
        const active = aiConfig.providers.find((p: any) => p.id === providerId)
        if (active?.reasoningEffort) {
          setReasoningEffortState(active.reasoningEffort)
        } else {
          setReasoningEffortState('off')
        }
      }
    },
    [loadArtifactStatus],
  )

  // ── Derived state ──

  const abortRef = useRef<{ abort: () => void } | null>(null)
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

    // Reasoning effort
    reasoningEffort,
    setReasoningEffort,

    // Auto-approve
    autoApprove,
    setAutoApproveForSession,

    // Active project folder
    activeProjectFolder,
    setActiveProjectFolder,

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
