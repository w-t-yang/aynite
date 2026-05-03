import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Send, Bot, History, Settings, X, Calendar, Clock, AlertTriangle, Terminal, Folder, Check, Copy } from 'lucide-react';
import { AgentMessage } from '../../../src/lib/agent';
import { SettingsState } from '../../lib/types';
import { useChat } from '../../context/ChatMockContext';
import ChatInput, { ChatInputHandle } from '../../featured/ChatInput';
import { ChatMessage } from '../../featured/ChatMessage';
import { SelectionPopover } from '../../featured/SelectionPopover';
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
          <button 
            onClick={() => { loadSessions(); setShowHistory(true); }}
            className="p-2 hover:bg-accent rounded-md transition-colors text-muted-foreground hover:text-foreground"
            title="History"
          >
            <History size={18} />
          </button>
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

      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-3xl bg-background border border-border/50 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-border/50 flex items-center justify-between bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center">
                  <History size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-widest">Chat Sessions</h2>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight opacity-70">Historical sessions</p>
                </div>
              </div>
              <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-accent rounded-full transition-colors"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {sessions.map(s => (
                <button 
                  key={s.id} 
                  onClick={() => { aynite.loadChatLog(s.id, s.date).then(setMessages); setSessionId(s.id); setShowHistory(false); }}
                  className="w-full text-left p-3 rounded-lg hover:bg-accent/50 border border-transparent hover:border-border/30 transition-all group flex gap-4 items-start"
                >
                  <div className="shrink-0 mt-1">
                    <div className="w-8 h-8 rounded bg-muted flex flex-col items-center justify-center text-[8px] font-bold text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                      <Calendar size={10} className="mb-0.5" />
                      {s.date.split('-').slice(1).join('/')}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-foreground/80 group-hover:text-primary transition-colors uppercase tracking-tight">Session {s.id.slice(-6)}</span>
                      <div className="flex items-center gap-2 text-[9px] text-muted-foreground/60 font-medium">
                        <Clock size={10} />
                        {new Date(s.lastModified).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <p className="text-[12px] text-muted-foreground/70 line-clamp-2 leading-relaxed">{s.preview || "No content"}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
