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
    handleApprove,
    handleReject,
    sendMessage,
    clearChat,
    loadSessions,
    copyToClipboard,
    revertToMessage,
    switchAgent,
    switchProvider,
  } = useAIChat()

  const scrollRef = useRef<HTMLDivElement>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [sessions, setSessions] = useState<any[]>([])

  useEffect(() => {
    if (scrollRef.current) {
      // Use requestAnimationFrame to ensure the DOM has updated
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
      })
    }
  }, [])

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

  const getFiles = useCallback(
    (path: string) => window.aynite.listFolder(path),
    [],
  )
  const getAllFiles = useCallback(() => window.aynite.workspaceAllFiles(), [])
  const getAvailableSkills = useCallback(
    () => window.aynite.getAvailableSkills(),
    [],
  )
  const getAvailableCommands = useCallback(
    () => window.aynite.getAvailableCommands(),
    [],
  )

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
      />

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
        onAbort={() => {}}
        onClear={clearChat}
        getFiles={getFiles}
        getAllFiles={getAllFiles}
        getAvailableSkills={getAvailableSkills}
        getAvailableCommands={getAvailableCommands}
      />

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
