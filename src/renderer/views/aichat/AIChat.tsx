import { Bot, Plus } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Header, InputArea, List, SessionsModal } from './components'
import { useAIChat } from './hooks/useAIChat'
import { getMessageText } from './utils/message'

export function AIChat() {
  const {
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
    copyToClipboard,
    revertToMessage,
    switchAgent,
    switchProvider,
    error,
    setError,
    artifactStatus,
    tokenCount,
  } = useAIChat()

  const scrollRef = useRef<HTMLDivElement>(null)
  const prevLoadingRef = useRef(loading)
  const [showHistory, setShowHistory] = useState(false)
  const [sessions, setSessions] = useState<any[]>([])

  useEffect(() => {
    const el = scrollRef.current
    if (!el || messages.length === 0) return

    // Detect whether this change is a streaming update (AI generating)
    // vs a bulk message load (initial load, session switch, revert).
    // During streaming: loading is true, or just transitioned true→false.
    const streamingUpdate = loading || (prevLoadingRef.current && !loading)

    if (streamingUpdate) {
      // During streaming - only scroll if user is already near the bottom
      const isNearBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight < 150
      if (isNearBottom) {
        requestAnimationFrame(() => {
          el.scrollTop = el.scrollHeight
        })
        setTimeout(() => {
          el.scrollTop = el.scrollHeight
        }, 100)
      }
    } else {
      // Bulk load (initial load, session switch) - always scroll to bottom
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight
      })
    }

    prevLoadingRef.current = loading
  }, [messages, loading])

  // Global actions for micro-app bridge
  useEffect(() => {
    ;(window as any).focusChatInput = (prefix?: string) => {
      if (prefix) inputRef.current?.trigger(prefix)
      else inputRef.current?.focus()
    }
    ;(window as any).showChatHistory = async () => {
      const res = await loadSessions()
      setSessions(res)
      setShowHistory(true)
    }
    ;(window as any).clearChat = clearChat
    ;(window as any).copyChat = () =>
      copyToClipboard(messages.map((m) => getMessageText(m)).join('\n\n'))

    return () => {
      delete (window as any).focusChatInput
      delete (window as any).showChatHistory
      delete (window as any).clearChat
      delete (window as any).copyChat
    }
  }, [messages, clearChat, copyToClipboard, loadSessions, inputRef])

  const getAllFiles = useCallback(() => window.aynite.workspaceAllFiles(), [])
  const getAvailableSkills = useCallback(
    () => window.aynite.getAvailableSkills(),
    [],
  )
  const getAvailableCommands = useCallback(
    () => window.aynite.getAvailableCommands(),
    [],
  )

  const hasProviders =
    settings.ai?.providers && settings.ai.providers.length > 0

  const openAISettings = () => {
    window.aynite.executeAppOperation('SETTINGS', { tab: 'ai' })
  }

  return (
    <div className="chat-panel flex flex-col h-full bg-card relative overflow-hidden">
      <div className="absolute inset-0 bg-ambient-gradient z-base opacity-40" />

      <Header
        settings={settings}
        onShowHistory={async () => {
          const res = await loadSessions()
          setSessions(res)
          setShowHistory(true)
        }}
        onClear={clearChat}
        onCopy={() => {
          try {
            const text = messages.map((m) => getMessageText(m)).join('\n\n')
            copyToClipboard(text)
          } catch (e) {
            console.error('[AIChat] Failed to serialize session for copy:', e)
          }
        }}
        onSwitchAgent={switchAgent}
        onSwitchProvider={switchProvider}
        artifactStatus={artifactStatus}
        tokenCount={tokenCount}
      />

      {hasProviders ? (
        <>
          <List
            ref={scrollRef}
            messages={messages}
            loading={loading}
            currentStep={currentStep}
            pendingApproval={pendingApproval}
            onApprove={handleApprove}
            onReject={handleReject}
            onOpenFile={(path) => window.aynite.openFile(path)}
            onCopy={copyToClipboard}
            onRevert={revertToMessage}
          />

          <InputArea
            ref={inputRef}
            workspaceFolders={workspaceFolders}
            loading={loading}
            onSend={sendMessage}
            onAbort={() => abortRef.current?.abort()}
            onClear={clearChat}
            getAllFiles={getAllFiles}
            getAvailableSkills={getAvailableSkills}
            getAvailableCommands={getAvailableCommands}
            error={error}
            setError={setError}
            artifactStatus={artifactStatus}
            tokenCount={tokenCount}
          />
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-10 text-center z-base relative">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6 animate-pulse">
            <Bot size={40} className="text-primary" />
          </div>
          <h3 className="text-2xl font-bold mb-2">
            No AI Providers Configured
          </h3>
          <p className="text-muted-foreground max-w-sm mb-8 leading-relaxed">
            To start using the AI assistant, you need to configure at least one
            provider (Ollama, OpenAI, Anthropic, etc.) in the settings.
          </p>
          <button
            type="button"
            onClick={openAISettings}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-all flex items-center gap-2 shadow-lg shadow-primary/20"
          >
            <Plus size={18} /> Setup AI Providers
          </button>
        </div>
      )}

      {showHistory && (
        <SessionsModal
          sessions={sessions}
          onSelect={(id) => window.aynite.setConfig('activeSessionId', id)}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  )
}
