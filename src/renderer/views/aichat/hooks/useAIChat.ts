import type { TextStreamPart, UIMessage } from 'ai'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppEvents } from '../../../../lib/constants/app'
import { DEFAULT_SETTINGS } from '../../../../lib/constants/settings'
import type { SettingsState } from '../../../shared/lib/types'
import { useAppEventSubscriber } from '../../../views/ViewContext'
import type { ChatInputHandle } from '../components/InputEditor'
import { type AgentLoopConfig, runAgentLoop } from '../utils/agent'
import { executeCommandOnly } from '../utils/commands'
import {
  appendPartToAssistant,
  appendReasoningToAssistant,
  appendToAssistant,
  appendToolInputDeltaToAssistant,
  genId,
  updateToolResult,
} from '../utils/message'

// import { MOCK_MESSAGES } from '../utils/mocks'

export function useAIChat() {
  const subscribeToAppEvents = useAppEventSubscriber()
  const [settings, setSettings] = useState<SettingsState>(
    DEFAULT_SETTINGS as SettingsState,
  )
  const [activeTabPath, setActiveTabPath] = useState<string>('')
  const [workspaceFolders, setWorkspaceFolders] = useState<string[]>([])
  const [messages, setMessages] = useState<UIMessage[]>([])
  // const [messages, setMessages] = useState<UIMessage[]>(MOCK_MESSAGES)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState<TextStreamPart<any> | null>(
    null,
  )
  const [error, setError] = useState<{
    message: string
    redacted: string
  } | null>(null)

  const inputRef = useRef<ChatInputHandle>(null)
  const abortRef = useRef<AbortController | null>(null)
  const loadingRef = useRef(loading)

  useEffect(() => {
    loadingRef.current = loading
  }, [loading])

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

  const loadSessions = useCallback(async () => {
    const res = await window.aynite.listSessions()
    return res || []
  }, [])

  const approvalIdRef = useRef<string | null>(null)
  const [pendingApproval, setPendingApproval] = useState<{
    command: string
    cwd: string
  } | null>(null)

  useEffect(() => {
    loadSettings()
    loadWorkspaceFolders()
  }, [loadSettings, loadWorkspaceFolders])

  useAppEventSubscriber()((event) => {
    if (event.type === 'config-changed') loadSettings()
    if (event.type === 'workspace-changed') loadWorkspaceFolders()
    if (event.type === 'active-tab-changed') setActiveTabPath(event.data.path)
    if (event.type === AppEvents.ACTIVE_SESSION_CHANGED) {
      const { id } = event.data as { id: string }
      window.aynite.loadSession(id).then((res: any) => {
        if (res) {
          setMessages(res)
          setSessionId(id)
        }
      })
    }
    if (event.type === AppEvents.AI_APPROVAL_REQUEST) {
      const { id, command, cwd } = event.data as any
      approvalIdRef.current = id
      setPendingApproval({ command, cwd })
    }
  })

  useEffect(() => {
    const loadInitialSession = async () => {
      const activeSessionId = await window.aynite.getConfig('activeSessionId')
      if (activeSessionId) {
        const res = await window.aynite.loadSession(activeSessionId)
        if (res) {
          setMessages(res)
          setSessionId(activeSessionId)
        }
      }
    }

    loadInitialSession()
  }, [])

  useEffect(() => {
    if (messages.length > 0 && !sessionId) {
      const newId = Date.now().toString()
      setSessionId(newId)
    }
  }, [messages, sessionId])

  useEffect(() => {
    if (sessionId && messages.length > 0) {
      const timer = setTimeout(async () => {
        try {
          const activeId = settingsRef.current.ai?.activeId
          const activeProvider =
            settingsRef.current.ai?.providers?.find((p) => p.id === activeId) ||
            settingsRef.current.ai?.providers?.[0]

          const activeAgent = settingsRef.current.agents?.list?.find(
            (a) => a.id === settingsRef.current.agents?.activeId,
          )

          const metadata = {
            agentName: activeAgent?.name || 'Chat',
            modelName: activeProvider?.name || activeProvider?.model || 'AI',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }

          await window.aynite.saveSession(sessionId, messages, metadata)
        } catch (_err) {}
      }, 1000)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [messages, sessionId])

  const handleApprove = useCallback(() => {
    if (approvalIdRef.current) {
      window.aynite.respondToAiApproval(approvalIdRef.current, true)
      approvalIdRef.current = null
    }
    setPendingApproval(null)
  }, [])

  const handleReject = useCallback(() => {
    if (approvalIdRef.current) {
      window.aynite.respondToAiApproval(approvalIdRef.current, false)
      approvalIdRef.current = null
    }
    setPendingApproval(null)
  }, [])

  const messagesRef = useRef(messages)
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const settingsRef = useRef(settings)
  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  const workspaceFoldersRef = useRef(workspaceFolders)
  useEffect(() => {
    workspaceFoldersRef.current = workspaceFolders
  }, [workspaceFolders])

  const activeTabPathRef = useRef(activeTabPath)
  useEffect(() => {
    activeTabPathRef.current = activeTabPath
  }, [activeTabPath])

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || loadingRef.current) return
      setError(null)

      const commandMentionRegex = />cmd\[(.*?)\]\((.*?)\)/g
      const skillMentionRegex = /\/skill\[(.*?)\]\((.*?)\)/g

      if (
        await executeCommandOnly(
          text,
          activeTabPathRef.current,
          messagesRef.current,
          setMessages,
          setLoading,
        )
      )
        return

      const commandMatches = [...text.matchAll(commandMentionRegex)]
      const commandResults: {
        name: string
        stdout: string
        stderr: string
        error?: string
      }[] = []

      if (commandMatches.length > 0) {
        setLoading(true)
        for (const match of commandMatches) {
          const [_full, name, path] = match
          try {
            const res = await window.aynite.runDirectCommand({
              commandPath: path,
              params: [],
              currentFile: activeTabPathRef.current,
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
        setLoading(false)
      }

      const activeId = settingsRef.current.ai?.activeId
      const activeProvider =
        settingsRef.current.ai?.providers?.find((p) => p.id === activeId) ||
        settingsRef.current.ai?.providers?.[0]

      const activeAgent = settingsRef.current.agents?.list?.find(
        (a) => a.id === settingsRef.current.agents?.activeId,
      )
      const agentPromptFiles = activeAgent?.promptFiles || []

      const agentConfig: AgentLoopConfig = {
        id: activeProvider?.id || 'chat',
        name: activeProvider?.name || 'Chat',
        provider: activeProvider?.provider || 'ollama',
        apiKey: activeProvider?.apiKey || '',
        baseUrl: activeProvider?.baseUrl || '',
        model: activeProvider?.model || '',
        compatibility: activeProvider?.compatibility,
        enabledTools: settingsRef.current.aiTools,
        agentPromptFiles,
      }

      // Build command results text inline (no separate commandResults field)
      let resultsText = ''
      for (const res of commandResults) {
        const content = [res.stdout, res.stderr]
          .filter(Boolean)
          .join('\n')
          .trim()
        const result =
          content || (res.error ? `Error: ${res.error}` : '(No output)')
        resultsText += `> Command: ${res.name}\n${result}\n\n---\n\n`
      }

      const initialMessages = [...messagesRef.current]
      if (initialMessages.length === 0) {
        const globalPromptFiles = settingsRef.current.prompts?.files || []
        const systemPrompt = await window.aynite.getMergedSystemPrompt(
          globalPromptFiles,
          agentPromptFiles,
        )
        if (systemPrompt) {
          initialMessages.push({
            id: genId(),
            role: 'system',
            parts: [{ type: 'text', text: systemPrompt }],
          })
        }
      }

      // Create user message with command results inlined as text
      const userText = resultsText
        ? `${text}\n\nI ran local commands, here are the results:\n\n${resultsText}`
        : text

      const userMsg: UIMessage = {
        id: genId(),
        role: 'user',
        parts: [{ type: 'text', text: userText }],
      }

      const updatedMessages = [...initialMessages, userMsg]
      setMessages(updatedMessages)
      setLoading(true)

      const cleanText = text
        .replace(skillMentionRegex, '')
        .replace(commandMentionRegex, '')
        .trim()

      if (!cleanText && commandMatches.length > 0) {
        setLoading(false)
        return
      }

      const abort = new AbortController()
      abortRef.current = abort

      try {
        const resultHistory = await runAgentLoop(
          updatedMessages,
          agentConfig,
          workspaceFoldersRef.current,
          (event: TextStreamPart<any>) => {
            setCurrentStep(event)
            switch (event.type) {
              case 'text-delta':
                setMessages((prev) => appendToAssistant(prev, event.text))
                break
              case 'reasoning-delta':
                setMessages((prev) =>
                  appendReasoningToAssistant(prev, event.text),
                )
                break
              case 'tool-input-delta':
                setMessages((prev) =>
                  appendToolInputDeltaToAssistant(prev, event.id, event.delta),
                )
                break
              case 'tool-call':
                setMessages((prev) =>
                  appendPartToAssistant(prev, {
                    toolCallId: event.toolCallId,
                    toolName: event.toolName,
                    input: event.input,
                  }),
                )
                break
              case 'tool-result':
                setMessages((prev) =>
                  updateToolResult(prev, {
                    toolCallId: event.toolCallId,
                    toolName: event.toolName,
                    output: event.output,
                  }),
                )
                break
              case 'error':
                setError({
                  message: String(event.error),
                  redacted: String(event.error).includes('fetch failed')
                    ? 'Connection failed. Please check if your AI provider service is running.'
                    : String(event.error).includes('401') ||
                        String(event.error).includes('invalid_api_key')
                      ? 'Authentication failed. Please check your API key.'
                      : 'An error occurred while communicating with the AI provider.',
                })
                break
              case 'finish':
                setCurrentStep(null)
                break
            }
          },
          activeTabPathRef.current,
          abort.signal,
          subscribeToAppEvents,
        )
        setMessages(resultHistory)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        setError({
          message: msg,
          redacted:
            'A system error occurred. Please check your configuration and try again.',
        })
      } finally {
        setLoading(false)
        setCurrentStep(null)
        abortRef.current = null
      }
    },
    [subscribeToAppEvents],
  )

  const clearChat = useCallback(() => {
    setMessages([])
    setSessionId(null)
    abortRef.current?.abort()
  }, [])

  const copyToClipboard = useCallback((text: string) => {
    window.aynite
      .writeClipboard(text)
      .catch((err) => console.error('[useAIChat] Failed to copy', err))
  }, [])

  const revertToMessage = useCallback((index: number) => {
    setMessages((prev) => {
      if (index < 0 || index >= prev.length) return prev
      return prev.slice(0, index)
    })
  }, [])

  const switchAgent = useCallback(async (agentId: string) => {
    await window.aynite.setConfig('agents', { activeId: agentId })
  }, [])

  const switchProvider = useCallback(async (providerId: string) => {
    await window.aynite.setConfig('ai', { activeId: providerId })
  }, [])

  return {
    settings,
    messages,
    loading,
    currentStep,
    pendingApproval,
    workspaceFolders,
    inputRef,
    abortRef,
    handleApprove,
    handleReject,
    sendMessage,
    clearChat,
    loadSessions,
    setMessages,
    setSessionId,
    copyToClipboard,
    revertToMessage,
    switchAgent,
    switchProvider,
    error,
    setError,
  }
}
