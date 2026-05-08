import { useCallback, useEffect, useRef, useState } from 'react'
import { AppEvents } from '../../../../lib/constants/app'
import { DEFAULT_SETTINGS } from '../../../../lib/constants/settings'
import type {
  ChatMessage,
  CommandResultPart,
  LocalCommandMessage,
  StreamPart,
} from '../../../../lib/types/chat'
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
} from '../utils/message'

// import { MOCK_MESSAGES } from '../utils/mocks'

export function useAIChat() {
  const subscribeToAppEvents = useAppEventSubscriber()
  const [settings, setSettings] = useState<SettingsState>(
    DEFAULT_SETTINGS as SettingsState,
  )
  const [activeTabPath, setActiveTabPath] = useState<string>('')
  const [workspaceFolders, setWorkspaceFolders] = useState<string[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  // const [messages, setMessages] = useState<ChatMessage[]>(MOCK_MESSAGES)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState<StreamPart | null>(null)

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
    if (event.type === AppEvents.AI_APPROVAL_REQUEST) {
      const { id, command, cwd } = event.data as any
      approvalIdRef.current = id
      setPendingApproval({ command, cwd })
    }
  })

  useEffect(() => {
    const lastSession = localStorage.getItem('lastSession')
    if (lastSession) {
      try {
        const { id, date } = JSON.parse(lastSession)
        window.aynite.loadSession(id, date).then((res: any) => {
          if (res) {
            setMessages(res)
            setSessionId(id || null)
          }
        })
      } catch (_e) {}
    }
  }, [])

  useEffect(() => {
    if (messages.length > 0 && !sessionId) {
      const newId = Date.now().toString()
      const dateStr = new Date().toISOString().split('T')[0]
      setSessionId(newId)
      localStorage.setItem(
        'lastSession',
        JSON.stringify({ id: newId, date: dateStr }),
      )
    }
  }, [messages, sessionId])

  useEffect(() => {
    if (sessionId && messages.length > 0) {
      const timer = setTimeout(async () => {
        try {
          await window.aynite.saveSession(sessionId, messages)
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

      const results: CommandResultPart[] = []
      for (const res of commandResults) {
        const content = [res.stdout, res.stderr]
          .filter(Boolean)
          .join('\n')
          .trim()
        const result =
          content || (res.error ? `Error: ${res.error}` : '(No output)')

        results.push({
          command: res.name,
          result,
          exitCode: res.error ? 1 : 0,
        })
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
            createdAt: new Date(),
          })
        }
      }

      const userMsg: ChatMessage = {
        id: genId(),
        role: 'user',
        parts: [{ type: 'text', text: text }],
        createdAt: new Date(),
      }
      if (results.length > 0) {
        ;(userMsg as LocalCommandMessage).commandResults = results
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
          (event: StreamPart) => {
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
                setMessages((prev) => appendPartToAssistant(prev, event))
                break
              case 'tool-result':
                setMessages((prev) => appendPartToAssistant(prev, event))
                break
              case 'error':
                setMessages((prev) => [
                  ...prev,
                  {
                    id: genId(),
                    role: 'assistant',
                    parts: [
                      { type: 'text', text: `**Error**: ${event.error}` },
                    ],
                    createdAt: new Date(),
                  },
                ])
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
        setMessages((prev) => [
          ...prev,
          {
            id: genId(),
            role: 'assistant',
            parts: [
              {
                type: 'text',
                text: `❌ **System Error**: ${e instanceof Error ? e.message : String(e)}`,
              },
            ],
            createdAt: new Date(),
          },
        ])
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
    localStorage.removeItem('lastSession')
    abortRef.current?.abort()
  }, [])

  const copyToClipboard = useCallback((text: string) => {
    window.aynite
      .writeClipboard(text)
      .catch((err) => console.error('[useAIChat] Failed to copy', err))
  }, [])

  const revertToMessage = useCallback((id: string) => {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === id)
      if (idx === -1) return prev
      return prev.slice(0, idx + 1)
    })
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
  }
}
