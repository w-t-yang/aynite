import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, RefreshCw, Trash2, ChevronDown, ChevronRight, Terminal, FileText, FolderOpen, AlertTriangle, CheckCircle, XCircle, Copy, Save, Check, Folder, X, Settings, History, Calendar, Clock } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SettingsState } from '../lib/types';
import ChatInput, { ChatInputHandle } from './ChatInput';
import { runAgentLoop, AgentMessage, AgentStepEvent, AgentConfig } from '../lib/agent';


// ─── Message Types ───────────────────────────────────────────────────

// AgentMessage is defined in ../lib/agent.ts

// AgentMessage is defined in ../lib/agent.ts

function UnifiedCollapsible({ 
  title, 
  icon: Icon, 
  colorClass, 
  children, 
  defaultExpanded = false,
  borderPosition = 'left'
}: { 
  title: string; 
  icon: any; 
  colorClass: string; 
  children: React.ReactNode;
  defaultExpanded?: boolean;
  borderPosition?: 'left' | 'bottom';
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const textColor = colorClass.replace('border-', 'text-').replace(/\/.*$/, '');
  const borderStyle = borderPosition === 'left' ? `border-l-2 ${colorClass}` : '';

  return (
    <div className={`my-1 ${borderStyle} bg-muted/5 rounded-r px-3 py-1.5 overflow-hidden transition-all duration-200`}>

      <div className="flex items-center justify-between group">
        <button 
          onClick={() => setExpanded(!expanded)}
          className="flex-1 flex items-center justify-between"
        >
          <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tight">
            <Icon size={12} className={textColor} />
            <span>{title}</span>
          </div>
          <ChevronRight size={10} className={`text-muted-foreground/40 group-hover:text-primary transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} />
        </button>
      </div>
      {expanded && (
        <div className="mt-2 border-t border-border/10 pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
          {children}
        </div>
      )}
      {borderPosition === 'bottom' && <div className={`border-b ${colorClass} -mx-3 mt-2 opacity-50`} />}
    </div>
  );
}




// ─── Tool Call & Result Components ───────────────────────────────────
const isErrorMessage = (content: any) => {
  if (!content) return false;
  const c = typeof content === 'string' ? content.trim() : JSON.stringify(content);
  return c.startsWith('Error:') || c.startsWith('Execution Error:') || c.startsWith('❌') || c.includes('"status": "error"');
};

const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');

function ToolCallItem({ call, defaultExpanded = false }: { call: any; defaultExpanded?: boolean }) {
  const toolName = call.toolName || call.function?.name;
  const toolArgs = call.args || (typeof call.function?.arguments === 'string' ? JSON.parse(call.function.arguments) : call.function?.arguments);

  let Icon = Bot;
  let colorClass = 'border-primary/40';

  switch (toolName) {
    case 'read_file': Icon = FileText; colorClass = 'border-cyan-500/40'; break;
    case 'write_file': Icon = Save; colorClass = 'border-green-500/40'; break;
    case 'list_files': Icon = FolderOpen; colorClass = 'border-orange-500/40'; break;
    case 'run_command': Icon = Terminal; colorClass = 'border-red-500/40'; break;
  }

  return (
    <UnifiedCollapsible title={toolName} icon={Icon} colorClass={colorClass} defaultExpanded={defaultExpanded}>
      <pre className="text-[10px] font-mono text-muted-foreground/70 whitespace-pre-wrap overflow-auto max-h-60">
        {JSON.stringify(toolArgs, null, 2)}
      </pre>
      {call.result && (
        <div className="mt-2 border-t border-border/5 pt-2">
          <div className={cn(
            "text-[9px] font-bold mb-1 uppercase tracking-wider",
            isErrorMessage(call.result) ? "text-destructive/60" : "text-green-500/60"
          )}>
            {isErrorMessage(call.result) ? 'Error' : 'Result'}
          </div>
          <pre className={cn(
            "text-[10px] font-mono whitespace-pre-wrap max-h-96 overflow-auto opacity-90",
            isErrorMessage(call.result) ? "text-destructive/80" : "text-muted-foreground/60"
          )}>
            {typeof call.result === 'string' ? call.result : JSON.stringify(call.result, null, 2)}
          </pre>
        </div>
      )}
    </UnifiedCollapsible>
  );
}

function ThoughtBlock({ content, defaultExpanded = false }: { content: string; defaultExpanded?: boolean }) {
  if (!content?.trim()) return null;
  return (
    <UnifiedCollapsible title="Thinking Process" icon={Bot} colorClass="border-primary/40" defaultExpanded={defaultExpanded}>
      <div className="text-[11px] leading-relaxed text-muted-foreground/80 italic whitespace-pre-wrap">
        {content}
      </div>
    </UnifiedCollapsible>
  );
}

function ToolResultMessage({ name, content, defaultExpanded = false }: { name?: string; content: string; defaultExpanded?: boolean }) {
  const isError = isErrorMessage(content);
  return (
    <UnifiedCollapsible 
      title={isError ? `Error: ${name}` : `Result: ${name}`} 
      icon={isError ? XCircle : Check} 
      colorClass={isError ? "border-destructive/40" : "border-green-500/40"} 
      defaultExpanded={defaultExpanded}
    >
      <pre className={cn(
        "text-[10px] font-mono whitespace-pre-wrap max-h-96 overflow-auto",
        isError ? "text-destructive/80" : "text-muted-foreground/60"
      )}>
        {content}
      </pre>
    </UnifiedCollapsible>
  );
}


// ─── Command Approval Modal ─────────────────────────────────────────

function ApprovalModal({
  command,
  cwd,
  onApprove,
  onReject,
}: {
  command: string;
  cwd: string;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="relative group/approval my-2 overflow-hidden rounded-md border border-warning/30 bg-warning/5 backdrop-blur-md shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="absolute inset-0 bg-gradient-to-br from-warning/5 via-transparent to-transparent opacity-30" />
      
      <div className="relative p-3 space-y-3">
        <div className="flex items-center gap-2 text-warning">
          <div className="w-6 h-6 rounded bg-warning/20 flex items-center justify-center shrink-0">
            <AlertTriangle size={12} />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-90">Command Approval</span>
        </div>

        <div className="bg-background/40 border border-border/30 rounded px-2 py-1.5 shadow-inner">
          <div className="flex items-start gap-2">
             <Terminal size={12} className="text-muted-foreground mt-0.5 shrink-0" />
             <div className="flex flex-col gap-1 min-w-0 flex-1">
                <code className="text-xs text-foreground font-mono break-all leading-normal bg-accent/5 px-1.5 py-0.5 rounded border border-border/10 whitespace-pre-wrap">{command}</code>
                <div className="flex items-center gap-1 text-[9px] text-muted-foreground/60 font-medium">
                  <Folder size={8} />
                  <span className="truncate">{cwd}</span>
                </div>
             </div>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={onApprove}
            className="flex-1 h-8 rounded bg-warning text-warning-foreground hover:bg-warning/90 transition-all active:scale-[0.98] font-bold text-[10px] uppercase tracking-widest shadow shadow-warning/10 flex items-center justify-center gap-1.5 group/btn"
          >
            <Check size={12} className="group-hover/btn:scale-110 transition-transform" />
            Approve
          </button>
          <button
            onClick={onReject}
            className="flex-1 h-8 rounded bg-muted/30 border border-border/20 text-muted-foreground hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 transition-all active:scale-[0.98] font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 group/btn"
          >
            <X size={12} className="group-hover/btn:scale-110 transition-transform" />
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}


// ─── Thinking Process Component ─────────────────────────────────────

function ThinkingProcess({ content, defaultOpen = false }: { content: string; defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="my-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-[10px] font-bold tracking-tight uppercase text-muted-foreground/50 hover:text-primary/70 transition-colors py-0.5"
      >
        <Bot size={12} className={isOpen ? 'text-primary/60' : ''} />
        <span>Thought</span>
        <ChevronRight size={10} className={`transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
      </button>
      
      <div className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100 mt-1' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          <div className="text-[12px] leading-relaxed text-muted-foreground/80 italic bg-accent/5 px-2 py-1.5 rounded-md">
             <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
          </div>
        </div>
      </div>
    </div>
  );
}
// ─── Chat Message Component ─────────────────────────────────────────

function ChatMessage({ 
  msg, 
  idx, 
  total, 
  onOpenFile, 
  onCopy 
}: { 
  msg: AgentMessage; 
  idx: number; 
  total: number; 
  onOpenFile: (path: string) => void;
  onCopy: (content: string) => void;
}) {
  const isLast = idx === total - 1;
  const isAssistant = msg.role === 'assistant';
  // Note: We no longer collapse the whole message at the top level
  // because each internal part is now independently collapsible.




  return (
    <div
      className={`group/msg relative transition-all duration-300 max-w-4xl mx-auto py-1 rounded-sm border border-transparent ${
        msg.role === 'user' ? 'bg-foreground/[0.03] border-border/5 px-4' : ''
      }`}
    >
      <div className="flex flex-col gap-1">
        <div className="text-foreground text-sm leading-relaxed">
          {msg.role === 'system' ? (
            <SystemMessage content={msg.content} />
          ) : msg.role === 'assistant' ? (() => {
            const hasToolCalls = msg.tool_calls && msg.tool_calls.length > 0;
            const hasContent = !!(msg.content || '').replace(/<(?:thought|think)>[\s\S]*?<\/(?:thought|think)>/g, '').trim();
            
            return (
              <div className="space-y-1.5">
                {/* 1. Thinking Blocks First */}
                {msg.thinking && (
                  <ThoughtBlock 
                    content={msg.thinking} 
                    defaultExpanded={isLast && !hasContent && !hasToolCalls} 
                  />
                )}
                {[...(msg.content || '').matchAll(/<(?:thought|think)>([\s\S]*?)<\/(?:thought|think)>/g)].map((m, idx, array) => (
                  <ThoughtBlock 
                    key={idx} 
                    content={m[1].trim()} 
                    defaultExpanded={isLast && !hasContent && !hasToolCalls && idx === array.length - 1} 
                  />
                ))}

                {/* 2. Content Block Second */}
                {(msg.content || '').replace(/<(?:thought|think)>[\s\S]*?<\/(?:thought|think)>/g, '').trim() && (
                  <UnifiedCollapsible 
                    title="AI Response" 
                    icon={Bot} 
                    colorClass="border-primary/40" 
                    defaultExpanded={isLast && !hasToolCalls}
                    borderPosition="bottom"
                  >
                    <div className="py-0.5 relative group/content">
                      <MessageContent 
                        content={msg.content.replace(/<(?:thought|think)>[\s\S]*?<\/(?:thought|think)>/g, '').trim()} 
                        role="assistant" 
                        onOpenFile={onOpenFile} 
                      />
                      <div className="flex justify-end mt-2 opacity-0 group-hover/content:opacity-100 transition-opacity">
                        <button
                          onClick={() => onCopy(msg.content || '')}
                          className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider"
                          title="Copy Response"
                        >
                          <Copy size={12} />
                          <span>Copy</span>
                        </button>
                      </div>
                    </div>
                  </UnifiedCollapsible>
                )}

                {/* 3. Tool Calls Block Third */}
                {msg.tool_calls?.map((call, idx) => (
                  <ToolCallItem 
                    key={idx} 
                    call={call} 
                    defaultExpanded={isLast && idx === msg.tool_calls!.length - 1} 
                  />
                ))}
              </div>
            );
          })() : msg.role === 'tool' ? (
            <ToolResultMessage name={msg.name} content={msg.content} defaultExpanded={isLast} />
          ) : (
            <div className="py-0.5">
              <MessageContent content={msg.content} role={msg.role} onOpenFile={onOpenFile} />
            </div>
          )}
        </div>
      </div>



    </div>
  );
}


// ─── Message Rendering with Mentions ────────────────────────────────


function MessageContent({ content = '', role, onOpenFile }: { content?: string; role: string, onOpenFile?: (path: string) => void }) {
  if (role === 'assistant' || role === 'model') {
    const parts = [];
    let currentPos = 0;
    const combinedRegex = /<(think|thought)>([\s\S]*?)(?:<\/\1>|$)|\[\[View:(.*?)\]\]/g;
    let match;

    while ((match = combinedRegex.exec(content)) !== null) {
      // Add text before match
      if (match.index > currentPos) {
        parts.push(<Markdown key={`md-${currentPos}`} remarkPlugins={[remarkGfm]}>{content.substring(currentPos, match.index)}</Markdown>);
      }

      if (match[1]) {
        // It's a think/thought block
        parts.push(
          <ThinkingProcess 
            key={`think-${match.index}`} 
            content={match[2].trim()} 
            defaultOpen={false} 
          />
        );
      } else if (match[3]) {
        // It's a view link
        const path = match[3];
        parts.push(
          <button
            key={`view-${match.index}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onOpenFile?.(path);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-md text-xs font-medium transition-all my-2 group w-fit"
          >
            <FileText size={14} className="group-hover:scale-110 transition-transform" /> 
            <span>View Definition</span>
          </button>
        );
      }

      currentPos = combinedRegex.lastIndex;
    }

    if (currentPos < content.length) {
      parts.push(<Markdown key={`md-${currentPos}`} remarkPlugins={[remarkGfm]}>{content.substring(currentPos)}</Markdown>);
    }

    return (
      <div className="markdown-body prose prose-sm dark:prose-invert max-w-none break-words leading-relaxed">
        {parts}
      </div>
    );
  }


  // Pre-process user message to render mentions as rich tags
  const parts = [];
  let lastIndex = 0;
  
  // Regex to match our serialized mention formats
  // @file[label](id), @dir[label](id), /skill[label](id), >cmd[label](id)
  const mentionRegex = /(@file|@dir|\/skill|>cmd)\[(.*?)\]\((.*?)\)/g;
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(content.substring(lastIndex, match.index));
    }

    const type = match[1];
    const label = match[2];
    const id = match[3];

    // Map type to class
    let className = 'mention';
    if (type === '@file') className += ' mention-file';
    else if (type === '@dir') className += ' mention-dir';
    else if (type === '/skill') className += ' mention-skill';
    else if (type === '>cmd') className += ' mention-command';

    parts.push(
      <span key={match.index} className={className} title={id}>
        {label}
      </span>
    );

    lastIndex = mentionRegex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(content.substring(lastIndex));
  }

  return <div className="whitespace-pre-wrap">{parts}</div>;
}

// ─── Main Chat Component ─────────────────────────────────────────────

// ─── System Message Component ─────────────────────────────────────

function SystemMessage({ content }: { content: string }) {
  return (
    <UnifiedCollapsible title="System Prompt" icon={FileText} colorClass="border-muted-foreground/30">
      <div className="text-[11px] font-mono text-muted-foreground/70 whitespace-pre-wrap leading-relaxed">
        {content}
      </div>
    </UnifiedCollapsible>
  );
}

function SessionsModal({
  sessions,
  onSelect,
  onClose
}: {
  sessions: any[];
  onSelect: (id: string, date: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-2xl bg-background border border-border/50 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
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
          <button 
            onClick={onClose}
            className="p-2 hover:bg-accent rounded-full transition-colors text-muted-foreground hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground opacity-50 flex flex-col items-center gap-4">
              <History size={40} strokeWidth={1} />
              <p className="text-xs uppercase tracking-widest font-bold">No sessions found</p>
            </div>
          ) : (
            sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => { onSelect(s.id, s.date); onClose(); }}
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
                  <p className="text-[12px] text-muted-foreground/70 line-clamp-2 leading-relaxed">
                    {s.preview || "No content"}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}


export default function ChatTab({
  settings,
  workspaceFolders = [],
  onOpenFile,
  activeTabPath,
}: {
  settings: SettingsState;
  workspaceFolders?: string[];
  onOpenFile?: (file: { name: string; path: string, isDirectory: boolean }, content: string) => void;
  activeTabPath?: string;
}) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<ChatInputHandle>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Approval flow state
  const approvalResolveRef = useRef<((approved: boolean) => void) | null>(null);
  const [pendingApproval, setPendingApproval] = useState<{ command: string; cwd: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);

  const loadSessions = async () => {
    // @ts-ignore
    const res = await window.api.listChatLogs();
    if (res && res.data) {
      setSessions(res.data);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);



  const normalizeAndHealMessages = (msgs: any[]): AgentMessage[] => {
    // 1. Basic normalization (handle legacy logs with 'text' instead of 'content')
    const normalized = msgs.map((m: any) => ({
      ...m,
      id: m.id || Math.random().toString(36).slice(2, 11),
      content: m.content || m.text || ""
    }));

    const healed: AgentMessage[] = [];
    for (let i = 0; i < normalized.length; i++) {
      const m = normalized[i];
      healed.push(m);

      // If it's an assistant message with tool calls, ensure they have results
      if (m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0) {
        const existingResultIds = new Set<string>();
        let j = i + 1;
        // Scan forward for following tool results
        while (j < normalized.length && normalized[j].role === 'tool') {
          if (normalized[j].tool_call_id) {
            existingResultIds.add(normalized[j].tool_call_id);
          }
          j++;
        }

        // Add placeholder results for any missing tool call IDs
        for (const call of m.tool_calls) {
          const callId = call.toolCallId || call.id;
          if (callId && !existingResultIds.has(callId)) {
            healed.push({
              id: Math.random().toString(36).slice(2, 11),
              role: 'tool',
              content: "Task interrupted before completion.",
              tool_call_id: callId,
              name: call.toolName || call.function?.name
            });
          }
        }
      }
    }
    return healed;
  };

  useEffect(() => {
    const lastSession = localStorage.getItem('lastSession');
    if (lastSession) {
      try {
        const { id, date } = JSON.parse(lastSession);
        // @ts-ignore
        window.api.loadChatLog(id, date).then((res: any) => {
          if (res && res.data) {
            setMessages(normalizeAndHealMessages(res.data));
            setSessionId(id || null);
          }
        });
      } catch (e) {
        console.error('Failed to load last session from localStorage', e);
      }
    }
  }, []);



  useEffect(() => {
    if (messages.length > 0 && !sessionId) {
      const newId = new Date().getTime().toString();
      const dateStr = new Date().toISOString().split('T')[0];
      setSessionId(newId);
      localStorage.setItem('lastSession', JSON.stringify({ id: newId, date: dateStr }));
    }
  }, [messages, sessionId]);

  useEffect(() => {
    if (sessionId && messages.length > 0) {
      const timer = setTimeout(() => {
        // @ts-ignore
        window.api.saveChatLog(sessionId, messages);
      }, 1000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [messages, sessionId]);

  useEffect(() => {
    (window as any).focusChatInput = (prefix?: string) => {
      if (prefix) {
        inputRef.current?.trigger(prefix);
      } else {
        inputRef.current?.focus();
      }
    };
    (window as any).setChatSession = (id: string, date?: string) => {
      const dateStr = date || new Date().toISOString().split('T')[0];
      // @ts-ignore
      window.api.loadChatLog(id, dateStr).then((res: any) => {
        if (res && res.data) {
          setMessages(normalizeAndHealMessages(res.data));
          setSessionId(id);
          localStorage.setItem('lastSession', JSON.stringify({ id, date: dateStr }));
          console.log(`[Chat] Switched and healed session: ${id} (${dateStr})`);
        } else {
          setSessionId(id);
          setMessages([]);
          localStorage.setItem('lastSession', JSON.stringify({ id, date: dateStr }));
          console.log(`[Chat] Started new session with ID: ${id}`);
        }
        setTimeout(() => inputRef.current?.focus(), 100);
      });
    };
    (window as any).showChatHistory = () => {
      loadSessions();
      setShowHistory(true);
    };

    return () => {
      delete (window as any).focusChatInput;
      delete (window as any).setChatSession;
      delete (window as any).showChatHistory;
      delete (window as any).clearChat;
      delete (window as any).copyChat;
    };

  }, []);
  



  const handleOpenFile = async (filepath: string) => {
    if (!onOpenFile) return;
    try {
      // @ts-ignore
      const res = await window.api.readFile(filepath);
      if (res && res.data) {
        const name = filepath.split(/[/\\]/).pop() || filepath;
        // Ensure we pass the exactly same structure as Sidebar
        onOpenFile({ name, path: filepath, isDirectory: false }, res.data);
      }
    } catch (e) {
      console.error('Failed to open file', e);
    }
  };

  const genId = () => `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const requestApproval = useCallback(
    (command: string, cwd: string): Promise<boolean> => {
      return new Promise((resolve) => {
        approvalResolveRef.current = resolve;
        setPendingApproval({ command, cwd });
      });
    },
    []
  );

  const handleApprove = useCallback(() => {
    approvalResolveRef.current?.(true);
    approvalResolveRef.current = null;
    setPendingApproval(null);
  }, []);

  const handleReject = useCallback(() => {
    approvalResolveRef.current?.(false);
    approvalResolveRef.current = null;
    setPendingApproval(null);
  }, []);

    const sendMessage = useCallback(
      async (text: string) => {
        if (!text.trim() || loading) return;

        const commandMentionRegex = />cmd\[(.*?)\]\((.*?)\)/g;
        const skillMentionRegex = /\/skill\[(.*?)\]\((.*?)\)/g;
        const fileMentionRegex = /@(?:file|dir)\[(.*?)\]\((.*?)\)/g;

        // Check if it's a Command-Only Mode (starts with a command)
        const trimmedText = text.trim();
        const firstCmdMatch = trimmedText.match(/^>cmd\[(.*?)\]\((.*?)\)/);
        
        if (firstCmdMatch) {
          const [fullMatch, name, path] = firstCmdMatch;
          const remainingText = trimmedText.slice(fullMatch.length).trim();
          
          // Resolve all mentions in the parameters to absolute paths
          // Format: @file[name](path) -> path, /skill[name](path) -> path
          const resolvedParamsText = remainingText
            .replace(fileMentionRegex, '$2')
            .replace(skillMentionRegex, '$2')
            .replace(commandMentionRegex, '$2');
          
          // Split by spaces but preserve quoted strings if needed? 
          // For now, simple split is likely enough for basic usage.
          const params = resolvedParamsText.split(/\s+/).filter(Boolean);

          setLoading(true);
          try {
            // @ts-ignore
            const res = await window.api.runDirectCommand({ 
              commandPath: path, 
              params: params, 
              currentFile: activeTabPath 
            });
            
            const content = [res.data?.stdout, res.data?.stderr].filter(Boolean).join('\n').trim();
            const userMsg: AgentMessage = { id: genId(), role: 'user', content: text };
            const cmdMsg: AgentMessage = { 
              id: genId(), 
              role: 'tool', 
              name: name, 
              content: content || (res.error ? `Error: ${res.error}` : '(No output)')
            };
            
            setMessages([...messages, userMsg, cmdMsg]);
          } catch (e: any) {
            setMessages([...messages, { id: genId(), role: 'user', content: text }, { id: genId(), role: 'assistant', content: `❌ **Execution Error**: ${e.message}` }]);
          } finally {
            setLoading(false);
          }
          return;
        }

        // Normal Mode (AI involved)
        const currentMatches = [...text.matchAll(skillMentionRegex)];
        const commandMatches = [...text.matchAll(commandMentionRegex)];
        const commandResults: { name: string; stdout: string; stderr: string; error?: string }[] = [];


        if (commandMatches.length > 0) {
          setLoading(true);
          for (const match of commandMatches) {
            const [full, name, path] = match;
            try {
              // @ts-ignore
              const res = await window.api.runDirectCommand({ 
                commandPath: path, 
                params: [], 
                currentFile: activeTabPath 
              });
              commandResults.push({ 
                name, 
                stdout: res.data?.stdout || '', 
                stderr: res.data?.stderr || '',
                error: res.error 
              });
            } catch (e: any) {
              commandResults.push({ name, stdout: '', stderr: e.message, error: e.message });
            }
          }
        }

        const activeId = settings.ai?.activeId;
        const activeProvider = settings.ai?.providers?.find(p => p.id === activeId) || settings.ai?.providers?.[0];

        const agentConfig: AgentConfig = {
          provider: activeProvider?.provider || 'ollama',
          apiKey: activeProvider?.apiKey || '',
          baseUrl: activeProvider?.url || '',
          model: activeProvider?.model || '',
          compatibility: activeProvider?.compatibility,
          enabledTools: settings.aiTools
        };






        // 2. Add User Message
        const userMsg: AgentMessage = { id: genId(), role: 'user', content: text };
        let updatedMessages = [...messages, userMsg];

        // 3. Add Command Result Messages (if any)
        if (commandResults.length > 0) {
          for (const res of commandResults) {
            const content = [res.stdout, res.stderr].filter(Boolean).join('\n').trim();
            const cmdMsg: AgentMessage = { 
              id: genId(), 
              role: 'tool', 
              name: res.name, 
              content: content || (res.error ? `Error: ${res.error}` : '(No output)')
            };
            updatedMessages.push(cmdMsg);
          }
        }
        
        setMessages(updatedMessages);
        setLoading(true);

        const history: AgentMessage[] = updatedMessages.map((m) => ({
          ...m,
          content: m.content,
        }));

        const cleanText = text
          .replace(skillMentionRegex, '')
          .replace(commandMentionRegex, '')
          .trim();

        // If message only contained commands and no actual text/skills, don't trigger AI
        if (!cleanText && commandMatches.length > 0 && currentMatches.length === 0) {
          setLoading(false);
          return;
        }

        const abort = new AbortController();
        abortRef.current = abort;

        try {
          const promptText = text;
          const resultHistory = await runAgentLoop(
            promptText,
            history.slice(0, -1),
            agentConfig,
            workspaceFolders,
            (event: AgentStepEvent) => {
              if (event.type === 'text_delta') {
                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (last && last.role === 'assistant') {
                    const newLast = { ...last, content: last.content + event.content };
                    return [...prev.slice(0, -1), newLast];
                  }
                  return [...prev, { id: genId(), role: 'assistant', content: event.content }];
                });
              } else if (event.type === 'thinking') {
                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (last && last.role === 'assistant') {
                    const newLast = { ...last, thinking: (last.thinking || '') + event.content };
                    return [...prev.slice(0, -1), newLast];
                  }
                  return [...prev, { id: genId(), role: 'assistant', content: '', thinking: event.content }];
                });
              } else if (event.type === 'tool_call') {
                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  const call = { toolName: event.toolName, args: event.toolArgs, toolCallId: event.toolCallId };
                  if (last && last.role === 'assistant') {
                    const newLast = { ...last, tool_calls: [...(last.tool_calls || []), call] };
                    return [...prev.slice(0, -1), newLast];
                  }
                  return [...prev, { id: genId(), role: 'assistant', content: '', tool_calls: [call] }];
                });
              } else if (event.type === 'tool_result') {
                setMessages((prev) => {
                  // 1. Update the tool call result in the preceding assistant message for UI consistency
                  const newMessages = [...prev];
                  for (let i = newMessages.length - 1; i >= 0; i--) {
                    if (newMessages[i].role === 'assistant' && newMessages[i].tool_calls) {
                      const callIdx = newMessages[i].tool_calls?.findIndex(c => c.toolCallId === event.toolCallId);
                      if (callIdx !== -1) {
                        newMessages[i] = {
                          ...newMessages[i],
                          tool_calls: newMessages[i].tool_calls?.map((c, idx) => 
                            idx === callIdx ? { ...c, result: event.content } : c
                          )
                        };
                        break;
                      }
                    }
                  }
                  
                  // 2. Append the tool result as a separate message for the history
                  return [...newMessages, { 
                    id: genId(), 
                    role: 'tool', 
                    content: event.content, 
                    tool_call_id: event.toolCallId,
                    name: event.toolName 
                  }];
                });
              } else if (event.type === 'approval_request') {

                setPendingApproval({
                  command: event.toolArgs?.command || '',
                  cwd: event.toolArgs?.cwd || '',
                });
              } else if (event.type === 'error') {
                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (last && last.role === 'assistant' && last.content.includes('❌')) {
                    // Avoid duplicate error messages if already handled
                    return prev;
                  }
                  return [...prev, { 
                    id: genId(), 
                    role: 'assistant', 
                    content: `❌ **Error**: ${event.content}` 
                  }];
                });
              }
            },
            requestApproval,
            abort.signal
          );
          setMessages(resultHistory);

        } catch (e: any) {
          setMessages((prev) => [
            ...prev,
            {
              id: genId(),
              role: 'assistant',
              content: `❌ **System Error**: ${e.message}`,
            },
          ]);
        } finally {
          setLoading(false);
          abortRef.current = null;
          const active = document.activeElement;
          const isPanelFocused = active && (active.closest('.chat-panel') || active === document.body);
          if (isPanelFocused) {
            setTimeout(() => inputRef.current?.focus(), 10);
          }
        }
      },
      [settings, messages, workspaceFolders, requestApproval, activeTabPath]
    );

  const clearHistory = useCallback(() => {
    if (!showClearConfirm) {
      setShowClearConfirm(true);
      setTimeout(() => setShowClearConfirm(false), 3000); // Reset after 3 seconds
      return;
    }
    
    setMessages([]);
    setSessionId(null);
    localStorage.removeItem('lastSession');
    abortRef.current?.abort();
    setShowClearConfirm(false);

  }, [showClearConfirm]);
  const copyHistoryAsJson = useCallback(() => {
    const jsonStr = JSON.stringify(messages, null, 2);
    navigator.clipboard.writeText(jsonStr).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => console.error('Failed to copy', err));
  }, [messages]);

  useEffect(() => {
    (window as any).clearChat = () => {
      setMessages([]);
      setSessionId(null);
      localStorage.removeItem('lastSession');
      abortRef.current?.abort();
    };
    (window as any).copyChat = copyHistoryAsJson;
  }, [copyHistoryAsJson]);
  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => console.error('Failed to copy', err));
  }, []);

  const saveMessageToFile = useCallback(async (text: string) => {
    const filename = `ai-message-${Date.now()}.md`;
    
    // Use first workspace folder as base if available
    const baseDir = workspaceFolders.length > 0 ? workspaceFolders[0] : '';
    // @ts-ignore
    const fullPath = baseDir ? await window.api.joinPath(baseDir, filename) : filename;

    try {
      // @ts-ignore
      await window.api.saveFile(fullPath, text);
    } catch (err) {
      console.error('Failed to save file', err);
    }
  }, [workspaceFolders]);

  return (
    <div className="chat-panel flex flex-col h-full bg-background relative overflow-hidden">
      {/* Atmosphere Layer */}
      <div className="absolute inset-0 bg-ambient-gradient z-0 opacity-40" />
      
      {/* Message Area */}
      <div className="flex-1 overflow-y-auto px-6 pt-10 pb-32 space-y-1.5 mask-fade-vertical z-10" ref={scrollRef}>

        {messages.length === 0 && (
          <div className="text-muted-foreground flex flex-col items-center justify-center h-full space-y-6">
            <Bot size={48} className="opacity-50" />
            <div className="space-y-3 text-sm opacity-80">
              <p className="flex items-center gap-3">
                <span className="w-6 h-6 rounded bg-accent shrink-0 flex items-center justify-center text-xs font-mono font-bold">Aa</span>
                Type any text to talk to AI
              </p>
              <p className="flex items-center gap-3">
                <span className="w-6 h-6 rounded bg-accent shrink-0 flex items-center justify-center text-xs font-mono font-bold">@</span>
                Tag any file to the content
              </p>
              <p className="flex items-center gap-3">
                <span className="w-6 h-6 rounded bg-accent shrink-0 flex items-center justify-center text-xs font-mono font-bold">/</span>
                Call any registered AI skill
              </p>
              <p className="flex items-center gap-3">
                <span className="w-6 h-6 rounded bg-accent shrink-0 flex items-center justify-center text-xs font-mono font-bold">&gt;</span>
                Call any registered command
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <ChatMessage 
            key={msg.id} 
            msg={msg} 
            idx={idx} 
            total={messages.length} 
            onOpenFile={handleOpenFile} 
            onCopy={copyToClipboard} 
          />
        ))}




        {/* Inline Approval Modal */}
        {pendingApproval && (
          <div className="max-w-xl mx-auto">
            <ApprovalModal
              command={pendingApproval.command}
              cwd={pendingApproval.cwd}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          </div>
        )}

        {loading && !pendingApproval && (
          <div className="flex gap-4 max-w-4xl mx-auto justify-start">
            <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0">
              <RefreshCw size={18} className="animate-spin" />
            </div>
          </div>
        )}
      </div>

      {/* Input Area & Status Overlay */}
      <div className="p-6 pt-2 z-10 relative">
        <div className="max-w-4xl mx-auto relative">
          {/* Floating Status Pill */}
          <div className="absolute -top-10 left-0 right-0 flex items-center justify-between px-2 pointer-events-none">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-background/40 backdrop-blur-md border border-border/20 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 shadow-xl pointer-events-auto">
              {(() => {
                const active = settings.ai?.providers?.find(p => p.id === settings.ai?.activeId) || settings.ai?.providers?.[0];
                return (
                  <>
                    <Bot size={10} className="text-primary" />
                    <span>{active?.provider || 'ollama'}</span>
                    <span className="normal-case font-medium opacity-80 border-l border-border/20 pl-2">
                      {active?.model || ''}
                    </span>
                  </>
                );
              })()}
            </div>



            <div className="flex items-center gap-1.5 pointer-events-auto">
            </div>
          </div>

          <ChatInput
            ref={inputRef}
            onSubmit={sendMessage}
            disabled={loading}
            workspaceFolders={workspaceFolders}
            focusKeybinding={settings.keybindings.agent.focusChat}
            submitKeybinding={settings.keybindings.agent.submit}
          />
        </div>
      </div>
      {showHistory && (
        <SessionsModal 
          sessions={sessions} 
          onSelect={(id, date) => (window as any).setChatSession(id, date)}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  );
}
