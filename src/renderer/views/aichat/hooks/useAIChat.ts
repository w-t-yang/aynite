import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_SETTINGS } from '../../../../lib/constants/settings'
import type { StreamPart } from '../../../../lib/types/chat'
import type { ChatMessage, SettingsState } from '../../../shared/lib/types'
import { useAppEventSubscriber } from '../../../views/ViewContext'
import type { ChatInputHandle } from '../components/InputEditor'
import { type AgentConfig, runAgentLoop } from '../utils/agent'
import { executeCommandOnly } from '../utils/commands'
import {
  appendPartToAssistant,
  appendReasoningToAssistant,
  appendToAssistant,
  appendToolInputDeltaToAssistant,
  genId,
} from '../utils/message'

export function useAIChat() {
  const subscribeToAppEvents = useAppEventSubscriber()
  const [settings, setSettings] = useState<SettingsState>(
    DEFAULT_SETTINGS as SettingsState,
  )
  const [activeTabPath, setActiveTabPath] = useState<string>('')
  const [workspaceFolders, setWorkspaceFolders] = useState<string[]>([])
  // Uncomment the line below to use mock data for testing all message types
  // const [messages, setMessages] = useState<ChatMessage[]>(MOCK_SESSION)
  const [messages, setMessages] = useState<ChatMessage[]>([])
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
      const [resAI, resAgents, resTools] = await Promise.all([
        window.aynite.getConfig('ai'),
        window.aynite.getConfig('agents'),
        window.aynite.getConfig('tools'),
      ])
      setSettings((prev) => ({
        ...prev,
        ai: resAI || prev.ai,
        agents: resAgents || prev.agents,
        aiTools: resTools?.active || prev.aiTools,
      }))
    } catch (e) {
      console.error('[AIChat] Failed to load settings:', e)
    }
  }, [])

  const loadWorkspaceFolders = useCallback(async () => {
    const folders = await window.aynite.getWorkspaceFolders()
    if (folders) setWorkspaceFolders(folders)
  }, [])

  const loadSessions = useCallback(async () => {
    const res = await window.aynite.listSessions()
    return res || []
  }, [])

  // Approval flow state
  const approvalResolveRef = useRef<((approved: boolean) => void) | null>(null)
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
  })

  // Persistence
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
      } catch (e) {
        console.error('Failed to load last session from localStorage', e)
      }
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
        } catch (err) {
          console.error('[AIChat] Failed to auto-save session:', err)
        }
      }, 1000)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [messages, sessionId])

  const requestApproval = useCallback(
    (command: string, cwd: string): Promise<boolean> => {
      return new Promise((resolve) => {
        approvalResolveRef.current = resolve
        setPendingApproval({ command, cwd })
      })
    },
    [],
  )

  const handleApprove = useCallback(() => {
    approvalResolveRef.current?.(true)
    approvalResolveRef.current = null
    setPendingApproval(null)
  }, [])

  const handleReject = useCallback(() => {
    approvalResolveRef.current?.(false)
    approvalResolveRef.current = null
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

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || loadingRef.current) return

      const commandMentionRegex = />cmd\[(.*?)\]\((.*?)\)/g
      const skillMentionRegex = /\/skill\[(.*?)\]\((.*?)\)/g

      if (
        await executeCommandOnly(
          text,
          activeTabPath,
          messagesRef.current,
          setMessages,
          setLoading,
        )
      )
        return

      // Run embedded commands before AI
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
              currentFile: activeTabPath,
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

      const agentConfig: AgentConfig = {
        provider: activeProvider?.provider || 'ollama',
        apiKey: activeProvider?.apiKey || '',
        baseUrl: activeProvider?.url || '',
        model: activeProvider?.model || '',
        compatibility: activeProvider?.compatibility,
        enabledTools: settingsRef.current.aiTools,
        agentPromptFiles,
      }

      // Build messages
      const userMsg: ChatMessage = {
        id: genId(),
        role: 'user',
        content: text,
        createdAt: Date.now(),
      }
      const updatedMessages = [...messagesRef.current, userMsg]

      for (const res of commandResults) {
        const content = [res.stdout, res.stderr]
          .filter(Boolean)
          .join('\n')
          .trim()
        const output =
          content || (res.error ? `Error: ${res.error}` : '(No output)')
        const cmdMsg: ChatMessage = {
          id: genId(),
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: `cmd_${Date.now()}`,
              toolName: res.name,
              output,
            },
          ],
          createdAt: Date.now(),
        }
        updatedMessages.push(cmdMsg)
      }

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
          text,
          updatedMessages.slice(0, -1),
          agentConfig,
          workspaceFolders,
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
                setMessages((prev) => [
                  ...prev,
                  {
                    id: genId(),
                    role: 'tool',
                    content: [event],
                    createdAt: Date.now(),
                  },
                ])
                break
              case 'error':
                setMessages((prev) => [
                  ...prev,
                  {
                    id: genId(),
                    role: 'assistant',
                    content: `**Error**: ${event.error}`,
                    createdAt: Date.now(),
                  },
                ])
                break
              case 'finish':
                setCurrentStep(null)
                break
            }
          },
          requestApproval,
          activeTabPath,
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
            content: `❌ **System Error**: ${e instanceof Error ? e.message : String(e)}`,
            createdAt: Date.now(),
          },
        ])
      } finally {
        setLoading(false)
        setCurrentStep(null)
        abortRef.current = null
      }
    },
    [workspaceFolders, requestApproval, activeTabPath, subscribeToAppEvents],
  )

  const clearChat = useCallback(() => {
    setMessages([])
    setSessionId(null)
    localStorage.removeItem('lastSession')
    abortRef.current?.abort()
  }, [])

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard
      .writeText(text)
      .catch((err) => console.error('Failed to copy', err))
  }, [])

  // Public API
  return {
    settings,
    messages,
    loading,
    currentStep,
    pendingApproval,
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
  }
}
