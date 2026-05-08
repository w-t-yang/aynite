import { useEffect, useRef, useState } from 'react'
import { Header, InputArea, List, SessionsModal } from './components'
import { useAIChat } from './hooks/useAIChat'

export function AIChat() {
  const {
    settings,
    messages,
    loading,
    currentStep,
    pendingApproval,
    inputRef,
    handleApprove,
    handleReject,
    sendMessage,
    clearChat,
    loadSessions,
    setMessages,
    setSessionId,
    copyToClipboard,
  } = useAIChat()

  const scrollRef = useRef<HTMLDivElement>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [sessions, setSessions] = useState<any[]>([])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [])

  // Global actions for micro-app bridge
  useEffect(() => {
    ;(window as any).focusChatInput = (prefix?: string) => {
      if (prefix) inputRef.current?.trigger(prefix)
      else inputRef.current?.focus()
    }
    ;(window as any).setChatSession = (id: string, date?: string) => {
      const dateStr = date || new Date().toISOString().split('T')[0]
      window.aynite.loadSession(id, dateStr).then((res: any) => {
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
    ;(window as any).showChatHistory = async () => {
      const res = await loadSessions()
      setSessions(res)
      setShowHistory(true)
    }
    ;(window as any).clearChat = clearChat
    ;(window as any).copyChat = () =>
      copyToClipboard(messages.map((m) => m.content).join('\n\n'))

    return () => {
      delete (window as any).focusChatInput
      delete (window as any).setChatSession
      delete (window as any).showChatHistory
      delete (window as any).clearChat
      delete (window as any).copyChat
    }
  }, [
    messages,
    clearChat,
    copyToClipboard,
    loadSessions,
    inputRef,
    setMessages,
    setSessionId,
  ])

  return (
    <div className="chat-panel flex flex-col h-full bg-card relative overflow-hidden">
      <div className="absolute inset-0 bg-ambient-gradient z-0 opacity-40" />

      <Header
        settings={settings}
        onShowHistory={async () => {
          const res = await loadSessions()
          setSessions(res)
          setShowHistory(true)
        }}
        onClear={clearChat}
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
      />

      <InputArea
        ref={inputRef}
        loading={loading}
        copied={false}
        onSend={sendMessage}
        onAbort={() => {}}
        onClear={clearChat}
        onShowHistory={async () => {
          const res = await loadSessions()
          setSessions(res)
          setShowHistory(true)
        }}
        onCopyHistory={() =>
          copyToClipboard(messages.map((m) => m.content).join('\n\n'))
        }
        getFiles={(path) => window.aynite.listFolder(path)}
        getAvailableSkills={() => window.aynite.getAvailableSkills()}
        getAvailableCommands={() => window.aynite.getAvailableCommands()}
      />

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
