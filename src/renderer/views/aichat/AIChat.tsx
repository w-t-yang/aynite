import { Check, Copy, History } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_SETTINGS } from '../../../lib/constants/settings'
import {
  appendToAssistant,
  executeCommandOnly,
  genId,
  normalizeAndHealMessages,
} from '../../shared/featured/advanced/chat-helpers'
import { ChatMessageItem } from '../../shared/featured/advanced/ChatMessage'
import {
  ChatInput,
  type ChatInputHandle,
} from '../../shared/featured/ChatInput'
import { type AgentConfig, runAgentLoop } from '../../shared/lib/agent'
import type {
  AgentStepEvent,
  ChatMessage,
  SettingsState,
} from '../../shared/lib/types'
import { cn } from '../../shared/lib/utils'
import { FLEX_CENTER_GAP_3 } from '../../shared/lib/styles'
import {
  ApprovalModal,
  SessionsModal,
  ToolCallItem,
  ToolResultMessage,
  ThoughtBlock,
} from './components'

export function AIChat() {
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

  const loadSessions = async () => {
    const res = await window.aynite.listChatLogs()
    if (res) {
      setSessions(res)
    }
  }

  const _currentFileInfo = useMemo(() => {
    if (!activeTabPath || activeTabPath === 'Settings') return null

    const parts = activeTabPath.split(/[/\\]/)
    const fileName = parts.pop() || ''
    const wsFolder = workspaceFolders.find((f) => activeTabPath.startsWith(f))
    let folderDisplay = ''
    let hasSubfolders = false

    if (wsFolder) {
      folderDisplay =
        wsFolder.split(/[/\\]/).filter(Boolean).pop() || 'workspace'
      const relPath = activeTabPath.slice(wsFolder.length).replace(/^[/\\]/, '')
      const relParts = relPath.split(/[/\\]/)
      relParts.pop() // remove filename
      if (relParts.length > 0) {
        hasSubfolders = true
      }
    } else {
      folderDisplay = parts.pop() || 'external'
    }

    return { fileName, folderDisplay, hasSubfolders }
  }, [activeTabPath, workspaceFolders])

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
            setMessages(normalizeAndHealMessages(res))
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
      const timer = setTimeout(() => {
        window.aynite.saveChatLog(sessionId, messages)
      }, 1000)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [messages, sessionId])

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
          setMessages(normalizeAndHealMessages(res))
          setSessionId(id)
          localStorage.setItem(
            'lastSession',
            JSON.stringify({ id, date: dateStr }),
          )
          console.log(`[Chat] Switched and healed session: ${id} (${dateStr})`)
        } else {
          setSessionId(id)
          setMessages([])
          localStorage.setItem(
            'lastSession',
            JSON.stringify({ id, date: dateStr }),
          )
          console.log(`[Chat] Started new session with ID: ${id}`)
        }
        setTimeout(() => inputRef.current?.focus(), 100)
      })
    }
    ;(window as any).showChatHistory = () => {
      loadSessions()
      setShowHistory(true)
    }

    return () => {
      delete (window as any).focusChatInput
      delete (window as any).setChatSession
      delete (window as any).showChatHistory
      delete (window as any).clearChat
      delete (window as any).copyChat
    }
  }, [loadSessions])

  const _handleOpenFileInternal = async (filepath: string) => {
    if (!onOpenFile) return
    try {
      const res = await window.aynite.readFile(filepath)
      if (res) {
        const name = filepath.split(/[/\\]/).pop() || filepath
        // Ensure we pass the exactly same structure as Sidebar
        onOpenFile({ name, path: filepath, isDirectory: false }, res)
      }
    } catch (e) {
      console.error('Failed to open file', e)
    }
  }

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

      if (await executeCommandOnly(text, activeTabPath, messages, setMessages, setLoading)) return

      // Normal Mode (AI involved)
      const currentMatches = [...text.matchAll(skillMentionRegex)]
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
          } catch (e: Error | unknown) {
            const errorMsg = e instanceof Error ? e.message : String(e)
            commandResults.push({
              name,
              stdout: '',
              stderr: errorMsg,
              error: errorMsg,
            })
          }
        }
      }

      const activeId = settings.ai?.activeId
      const activeProvider =
        settings.ai?.providers?.find((p) => p.id === activeId) ||
        settings.ai?.providers?.[0]

      const activeAgent = settings.agents?.list?.find(
        (a) => a.id === settings.agents?.activeId,
      )
      const agentPromptFiles = activeAgent?.promptFiles || []

      const agentConfig: AgentConfig = {
        provider: activeProvider?.provider || 'ollama',
        apiKey: activeProvider?.apiKey || '',
        baseUrl: activeProvider?.url || '',
        model: activeProvider?.model || '',
        compatibility: activeProvider?.compatibility,
        enabledTools: settings.aiTools,
        agentPromptFiles, // Add this to AgentConfig interface if needed, or pass separately
      }

      // 2. Add User Message
      const userMsg: ChatMessage = { id: genId(), role: 'user', content: text }
      const updatedMessages = [...messages, userMsg]

      // 3. Add Command Result Messages (if any)
      if (commandResults.length > 0) {
        for (const res of commandResults) {
          const content = [res.stdout, res.stderr]
            .filter(Boolean)
            .join('\n')
            .trim()
          const cmdMsg: ChatMessage = {
            id: genId(),
            role: 'tool',
            name: res.name,
            content:
              content || (res.error ? `Error: ${res.error}` : '(No output)'),
          }
          updatedMessages.push(cmdMsg)
        }
      }

      setMessages(updatedMessages)
      setLoading(true)

      const history: ChatMessage[] = updatedMessages.map((m) => ({
        ...m,
        content: m.content,
      }))

      const cleanText = text
        .replace(skillMentionRegex, '')
        .replace(commandMentionRegex, '')
        .trim()

      // If message only contained commands and no actual text/skills, don't trigger AI
      if (
        !cleanText &&
        commandMatches.length > 0 &&
        currentMatches.length === 0
      ) {
        setLoading(false)
        return
      }

      const abort = new AbortController()
      abortRef.current = abort

      try {
        const promptText = text
        const resultHistory = await runAgentLoop(
          promptText,
          history.slice(0, -1),
          agentConfig,
          workspaceFolders,
          (event: AgentStepEvent) => {
            if (event.type === 'text_delta') {
              setMessages((prev) => {
                const lastContent = prev[prev.length - 1]?.content || ''
                return appendToAssistant(prev, {
                  content: lastContent + event.content,
                })
              })
            } else if (event.type === 'thinking') {
              setMessages((prev) => {
                const lastThinking = prev[prev.length - 1]?.thinking || ''
                return appendToAssistant(prev, {
                  thinking: lastThinking + event.content,
                })
              })
            } else if (event.type === 'tool_call') {
              const call = {
                toolName: event.toolName,
                args: event.toolArgs,
                toolCallId: event.toolCallId,
              }
              setMessages((prev) => {
                const lastCalls = prev[prev.length - 1]?.tool_calls || []
                return appendToAssistant(prev, {
                  tool_calls: [...lastCalls, call],
                })
              })
            } else if (event.type === 'tool_result') {
              setMessages((prev) => {
                // 1. Update the tool call result in the preceding assistant message for UI consistency
                const newMessages = [...prev]
                for (let i = newMessages.length - 1; i >= 0; i--) {
                  if (
                    newMessages[i].role === 'assistant' &&
                    newMessages[i].tool_calls
                  ) {
                    const callIdx = newMessages[i].tool_calls?.findIndex(
                      (c) => c.toolCallId === event.toolCallId,
                    )
                    if (callIdx !== -1) {
                      newMessages[i] = {
                        ...newMessages[i],
                        tool_calls: newMessages[i].tool_calls?.map((c, idx) =>
                          idx === callIdx ? { ...c, result: event.content } : c,
                        ),
                      }
                      break
                    }
                  }
                }

                // 2. Append the tool result as a separate message for the history
                return [
                  ...newMessages,
                  {
                    id: genId(),
                    role: 'tool',
                    content: event.content,
                    tool_call_id: event.toolCallId,
                    name: event.toolName,
                  },
                ]
              })
            } else if (event.type === 'approval_request') {
              setPendingApproval({
                command: event.toolArgs?.command || '',
                cwd: event.toolArgs?.cwd || '',
              })
            } else if (event.type === 'error') {
              setMessages((prev) => {
                const last = prev[prev.length - 1]
                if (
                  last &&
                  last.role === 'assistant' &&
                  last.content.includes('❌')
                ) {
                  // Avoid duplicate error messages if already handled
                  return prev
                }
                return [
                  ...prev,
                  {
                    id: genId(),
                    role: 'assistant',
                    content: `❌ **Error**: ${event.content}`,
                  },
                ]
              })
            }
          },
          requestApproval,
          activeTabPath,
          abort.signal,
        )
        setMessages(resultHistory)
      } catch (e: Error | unknown) {
        setMessages((prev) => [
          ...prev,
          {
            id: genId(),
            role: 'assistant',
            content: `❌ **System Error**: ${e instanceof Error ? e.message : String(e)}`,
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
      settings,
      messages,
      workspaceFolders,
      requestApproval,
      activeTabPath,
      loading,
    ],
  )

  const clearHistory = useCallback(() => {
    if (!showClearConfirm) {
      setShowClearConfirm(true)
      setTimeout(() => setShowClearConfirm(false), 3000) // Reset after 3 seconds
      return
    }

    setMessages([])
    setSessionId(null)
    localStorage.removeItem('lastSession')
    abortRef.current?.abort()
    setShowClearConfirm(false)
  }, [showClearConfirm])
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
    ;(window as any).clearChat = () => {
      setMessages([])
      setSessionId(null)
      localStorage.removeItem('lastSession')
      abortRef.current?.abort()
    }
    ;(window as any).copyChat = copyHistoryAsJson
  }, [copyHistoryAsJson])
  const saveMessageToFile = useCallback(
    async (text: string) => {
      const filename = `ai-message-${Date.now()}.md`

      // Use first workspace folder as base if available
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
            message={m}
            onCopy={copyToClipboard}
            onSave={saveMessageToFile}
            renderThought={(thought) => (
              <ThoughtBlock
                content={thought}
                defaultExpanded={idx === messages.length - 1}
              />
            )}
            renderToolCall={(call) => (
              <ToolCallItem
                call={call}
                defaultExpanded={idx === messages.length - 1}
              />
            )}
            renderToolResult={(name, content) => (
              <ToolResultMessage
                name={name}
                content={content}
                defaultExpanded={idx === messages.length - 1}
              />
            )}
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
          />

          {/* Micro Action Bar */}
          <div className="absolute -top-8 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <button
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
