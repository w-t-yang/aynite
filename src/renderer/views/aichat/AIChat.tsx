import { Check, Copy, History } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { MOCK_MESSAGES } from '../../../lib/constants/renderer/mocks'
import { FLEX_CENTER_GAP_3 } from '../../../lib/constants/renderer/styles'
import { DEFAULT_SETTINGS } from '../../../lib/constants/settings'
import type { StreamPart } from '../../../lib/types/chat'
import { ChatMessageItem } from '../../shared/featured/advanced/ChatMessage'
import {
  appendToAssistant,
  executeCommandOnly,
  genId,
} from '../../shared/featured/advanced/chat-helpers'
import {
  ChatInput,
  type ChatInputHandle,
} from '../../shared/featured/ChatInput'
import { type AgentConfig, runAgentLoop } from '../../shared/lib/agent'
import type { ChatMessage, SettingsState } from '../../shared/lib/types'
import { cn } from '../../shared/lib/utils'
import { useApp } from '../../src/context/AppContext'
import { ApprovalModal, SessionsModal } from './components'

export function AIChat() {
  const { subscribeToAppEvents } = useApp()
  const [settings, _setSettings] = useState<SettingsState>(
    DEFAULT_SETTINGS as SettingsState,
  )
  const [activeTabPath, _setActiveTabPath] = useState<string>('')
  const [workspaceFolders, _setWorkspaceFolders] = useState<string[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<ChatInputHandle>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Approval flow state
  const approvalResolveRef = useRef<((approved: boolean) => void) | null>(null)
  const [pendingApproval, setPendingApproval] = useState<{
    command: string
    cwd: string
  } | null>(null)
  const [copied, setCopied] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [sessions, setSessions] = useState<
    { id: string; date: string; lastModified: string; preview: string }[]
  >([])

  const loadSessions = useCallback(async () => {
    const res = await window.aynite.listChatLogs()
    if (res) {
      setSessions(res)
    }
  }, [])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [])

  useEffect(() => {
    const lastSession = localStorage.getItem('lastSession')
    if (lastSession) {
      try {
        const { id, date } = JSON.parse(lastSession)
        window.aynite.loadChatLog(id, date).then((res: any) => {
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

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch((err) => console.error('Failed to copy', err))
  }, [])

  const copyHistoryAsJson = useCallback(() => {
    copyToClipboard(JSON.stringify(messages, null, 2))
  }, [messages, copyToClipboard])

  useEffect(() => {
    if (sessionId && messages.length > 0) {
      const timer = setTimeout(async () => {
        try {
          await window.aynite.saveChatLog(sessionId, messages)
        } catch (err) {
          console.error('[AIChat] Failed to auto-save chat log:', err)
        }
      }, 1000)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [messages, sessionId])

  const settingsRef = useRef(settings)
  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  const messagesRef = useRef(messages)
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const sessionIdRef = useRef(sessionId)
  useEffect(() => {
    sessionIdRef.current = sessionId
  }, [sessionId])

  const handleOpenFile = useCallback((_path: string) => {}, [])
  const handleGetFiles = useCallback(
    (path: string) => window.aynite.listFolder(path),
    [],
  )
  const handleGetAvailableSkills = useCallback(
    () => window.aynite.getAvailableSkills(),
    [],
  )
  const handleGetAvailableCommands = useCallback(
    () => window.aynite.getAvailableCommands(),
    [],
  )

  useEffect(() => {
    ;(window as any).focusChatInput = (prefix?: string) => {
      if (prefix) {
        inputRef.current?.trigger(prefix)
      } else {
        inputRef.current?.focus()
      }
    }
    ;(window as any).setChatSession = (id: string, date?: string) => {
      const dateStr = date || new Date().toISOString().split('T')[0]
      window.aynite.loadChatLog(id, dateStr).then((res: any) => {
        if (res) {
          setMessages(res)
          setSessionId(id)
          localStorage.setItem(
            'lastSession',
            JSON.stringify({ id, date: dateStr }),
          )
        } else {
          setSessionId(id)
          setMessages([])
          localStorage.setItem(
            'lastSession',
            JSON.stringify({ id, date: dateStr }),
          )
        }
        setTimeout(() => inputRef.current?.focus(), 100)
      })
    }
    ;(window as any).showChatHistory = () => {
      loadSessions()
      setShowHistory(true)
    }
    ;(window as any).showMockMessages = () => {
      setMessages(MOCK_MESSAGES)
      setSessionId('mock-session')
    }
    ;(window as any).clearChat = () => {
      setMessages([])
      setSessionId(null)
      localStorage.removeItem('lastSession')
      abortRef.current?.abort()
    }
    ;(window as any).copyChat = () => {
      copyToClipboard(JSON.stringify(messagesRef.current, null, 2))
    }

    return () => {
      delete (window as any).focusChatInput
      delete (window as any).setChatSession
      delete (window as any).showChatHistory
      delete (window as any).showMockMessages
      delete (window as any).clearChat
      delete (window as any).copyChat
    }
  }, [loadSessions, copyToClipboard])

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

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return

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
        const promptText = text
        const resultHistory = await runAgentLoop(
          promptText,
          updatedMessages.slice(0, -1),
          agentConfig,
          workspaceFolders,
          (event: StreamPart) => {
            if (event.type === 'text-delta') {
              setMessages((prev) => appendToAssistant(prev, event.content))
            } else if (event.type === 'error') {
              setMessages((prev) => [
                ...prev,
                {
                  id: genId(),
                  role: 'assistant',
                  content: `**Error**: ${event.error}`,
                  createdAt: Date.now(),
                },
              ])
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
        abortRef.current = null
        const active = document.activeElement
        const isPanelFocused =
          active && (active.closest('.chat-panel') || active === document.body)
        if (isPanelFocused) {
          setTimeout(() => inputRef.current?.focus(), 10)
        }
      }
    },
    [
      workspaceFolders,
      requestApproval,
      activeTabPath,
      loading,
      subscribeToAppEvents,
    ],
  )

  const clearHistory = useCallback(() => {
    if (!showClearConfirm) {
      setShowClearConfirm(true)
      setTimeout(() => setShowClearConfirm(false), 3000)
      return
    }

    setMessages([])
    setSessionId(null)
    localStorage.removeItem('lastSession')
    abortRef.current?.abort()
    setShowClearConfirm(false)
  }, [showClearConfirm])

  const _saveMessageToFile = useCallback(
    async (text: string) => {
      const filename = `ai-message-${Date.now()}.md`
      const baseDir = workspaceFolders.length > 0 ? workspaceFolders[0] : ''
      const fullPath = baseDir
        ? await window.aynite.joinPath(baseDir, filename)
        : filename

      try {
        await window.aynite.writeFile(fullPath, text)
      } catch (err) {
        console.error('Failed to save file', err)
      }
    },
    [workspaceFolders],
  )

  return (
    <div className="chat-panel flex flex-col h-full bg-card relative overflow-hidden">
      {/* Atmosphere Layer */}
      <div className="absolute inset-0 bg-ambient-gradient z-0 opacity-40" />

      {/* Message Area */}
      <div
        className="flex-1 overflow-y-auto px-6 pt-4 pb-32 space-y-1.5 mask-fade-vertical z-10"
        ref={scrollRef}
      >
        {messages.length === 0 && (
          <div className="text-muted-foreground flex flex-col items-center justify-center h-full space-y-6">
            <div className="space-y-3 text-sm opacity-80">
              <p className={FLEX_CENTER_GAP_3}>
                <span className="w-6 h-6 rounded bg-accent shrink-0 flex items-center justify-center text-xs font-mono font-bold">
                  Aa
                </span>
                Type any text to talk to AI
              </p>
              <p className={FLEX_CENTER_GAP_3}>
                <span className="w-6 h-6 rounded bg-accent shrink-0 flex items-center justify-center text-xs font-mono font-bold">
                  /
                </span>
                Use <code className="text-primary font-bold">/skill</code> to
                mention AI skills
              </p>
              <p className={FLEX_CENTER_GAP_3}>
                <span className="w-6 h-6 rounded bg-accent shrink-0 flex items-center justify-center text-xs font-mono font-bold">
                  @
                </span>
                Use <code className="text-primary font-bold">@file</code> to
                reference files
              </p>
              <p className={FLEX_CENTER_GAP_3}>
                <span className="w-6 h-6 rounded bg-accent shrink-0 flex items-center justify-center text-xs font-mono font-bold">
                  &gt;
                </span>
                Use <code className="text-primary font-bold">&gt;cmd</code> to
                run custom commands
              </p>
            </div>
          </div>
        )}

        {messages.map((m, idx) => (
          <ChatMessageItem
            key={m.id || idx}
            msg={m}
            idx={idx}
            total={messages.length}
            onOpenFile={handleOpenFile}
            onCopy={copyToClipboard}
            settings={settings as any}
          />
        ))}

        {pendingApproval && (
          <ApprovalModal
            command={pendingApproval.command}
            cwd={pendingApproval.cwd}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        )}

        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground animate-pulse ml-12 py-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-50 ml-1">
              Assistant is thinking...
            </span>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background via-background to-transparent z-10">
        <div className="max-w-4xl mx-auto relative group">
          <ChatInput
            ref={inputRef}
            placeholder="Type your message or use / for skills..."
            onSend={sendMessage}
            loading={loading}
            onAbort={() => abortRef.current?.abort()}
            onClear={clearHistory}
            onShowHistory={() => {
              loadSessions()
              setShowHistory(true)
            }}
            getFiles={handleGetFiles}
            getAvailableSkills={handleGetAvailableSkills}
            getAvailableCommands={handleGetAvailableCommands}
          />

          {/* Micro Action Bar */}
          <div className="absolute -top-8 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <button
              type="button"
              onClick={copyHistoryAsJson}
              className={cn(
                'p-1.5 rounded bg-muted/50 hover:bg-accent text-muted-foreground hover:text-foreground transition-all flex items-center gap-1.5',
                copied && 'text-green-500',
              )}
              title="Copy Chat as JSON"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              <span className="text-[9px] font-bold uppercase">JSON</span>
            </button>
            <button
              type="button"
              onClick={() => {
                loadSessions()
                setShowHistory(true)
              }}
              className="p-1.5 rounded bg-muted/50 hover:bg-accent text-muted-foreground hover:text-foreground transition-all flex items-center gap-1.5"
              title="Session History"
            >
              <History size={12} />
              <span className="text-[9px] font-bold uppercase">Logs</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sessions Modal */}
      {showHistory && (
        <SessionsModal
          sessions={sessions}
          onSelect={(id, date) => (window as any).setChatSession(id, date)}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  )
}
