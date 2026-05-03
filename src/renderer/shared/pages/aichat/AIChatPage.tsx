import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Send, Bot, History, Settings, X, Calendar, Clock, AlertTriangle, Terminal, Folder, Check, Copy } from 'lucide-react';
import { AgentMessage } from '../../lib/types';
import { SettingsState } from '../../lib/types';
import { useChat } from '../../context/ChatMockContext';
import ChatInput, { ChatInputHandle } from '../../featured/ChatInput';
import { ChatMessage } from '../../featured/advanced/ChatMessage';
import { SelectionPopover } from '../../featured/SelectionPopover';
import { Button } from '../../basic/Button';
import { Modal } from '../../basic/Modal';
import { SelectionList } from '../../basic/SelectionList';
import { cn } from '../../lib/utils';

interface AIChatPageProps {
  activeTabPath?: string;
  workspaceFolders?: string[];
  onOpenFile?: (file: { name: string; path: string, isDirectory: boolean }, content: string) => void;
}

export function AIChatPage({ activeTabPath, workspaceFolders = [], onOpenFile }: AIChatPageProps) {
  const aynite = useChat();
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [settings, setSettings] = useState<SettingsState | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<ChatInputHandle>(null);

  useEffect(() => {
    aynite.getSettings().then(setSettings);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const loadSessions = async () => {
    const res = await aynite.listChatLogs();
    setSessions(res);
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: AgentMessage = { id: Date.now().toString(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      // Mock response for now, real implementation would call aynite.sendMessage or similar
      // but the user wants mock data.
      setTimeout(() => {
        const assistantMsg: AgentMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: "I've received your message. This is a mock response in the standalone Chat view."
        };
        setMessages(prev => [...prev, assistantMsg]);
        setLoading(false);
      }, 1000);
    } catch (e) {
      setLoading(false);
    }
  };

  if (!settings) return <div className="p-8 text-muted-foreground">Loading settings...</div>;

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden relative">
      {/* Header */}
      <div className="h-12 border-b border-border/40 flex items-center justify-between px-4 shrink-0 bg-background/50 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Bot size={18} />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold uppercase tracking-widest text-foreground/80">Aynite AI</span>
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight opacity-60">Assistant</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { loadSessions(); setShowHistory(true); }}
            title="History"
            className="text-muted-foreground hover:text-foreground"
          >
            <History size={18} />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-30 gap-4">
            <Bot size={64} strokeWidth={1} />
            <p className="text-sm font-medium uppercase tracking-widest">Start a conversation</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <ChatMessage
              key={msg.id || idx}
              msg={msg}
              idx={idx}
              total={messages.length}
              onOpenFile={async (path) => {
                const content = await aynite.readFile(path);
                onOpenFile?.({ name: path.split(/[/\\]/).pop() || path, path, isDirectory: false }, content);
              }}
              onCopy={(content) => navigator.clipboard.writeText(content)}
              settings={settings}
            />
          ))
        )}
        {loading && (
          <div className="max-w-4xl mx-auto flex items-center gap-3 text-muted-foreground animate-pulse">
            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
              <Bot size={14} />
            </div>
            <span className="text-xs font-medium uppercase tracking-widest">Thinking...</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 bg-gradient-to-t from-background via-background to-transparent pt-8">
        <div className="max-w-4xl mx-auto">
          <ChatInput
            ref={inputRef}
            onSubmit={handleSendMessage}
            disabled={loading}
            workspaceFolders={workspaceFolders}
            getFiles={aynite.getFiles}
            getAvailableSkills={aynite.getAvailableSkills}
            getAvailableCommands={aynite.getAvailableCommands}
          />
        </div>
      </div>

      <Modal
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        title="Chat Sessions"
        size="lg"
      >
        <div className="flex-1 overflow-y-auto">
          <SelectionList
            items={sessions.map(s => ({
              id: s.id,
              label: `Session ${s.id.slice(-6)}`,
              subtitle: s.preview || "No content",
              badge: new Date(s.lastModified).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              icon: (
                <div className="w-8 h-8 rounded bg-muted flex flex-col items-center justify-center text-[8px] font-bold text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary transition-colors shrink-0">
                  <Calendar size={10} className="mb-0.5" />
                  {s.date.split('-').slice(1).join('/')}
                </div>
              ),
              date: s.date // Keep for handler
            }))}
            selectedIndex={-1}
            onSelect={(item) => {
              aynite.loadChatLog(item.id, item.date).then(setMessages);
              setSessionId(item.id);
              setShowHistory(false);
            }}
            itemClassName="py-4 border-b border-border/10 last:border-0"
          />
        </div>
      </Modal>
    </div>
  );
}
