import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, RefreshCw, Trash2, ChevronDown, ChevronRight, Terminal, FileText, FolderOpen, AlertTriangle, CheckCircle, XCircle, Copy, Save, Check } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SettingsState } from './Settings';
import ChatInput, { ChatInputHandle } from './ChatInput';
import { runAgentLoop, AgentMessage, AgentStepEvent, AgentConfig, getSystemPrompt } from '../lib/agent';

// ─── Message Types ───────────────────────────────────────────────────

// AgentMessage is defined in ../lib/agent.ts

// AgentMessage is defined in ../lib/agent.ts

// ─── Tool Icons ──────────────────────────────────────────────────────

function ToolIcon({ name }: { name?: string }) {
  switch (name) {
    case 'read_file': return <FileText size={12} className="text-primary" />;
    case 'write_file': return <FileText size={12} className="text-green-400" />;
    case 'list_files': return <FolderOpen size={12} className="text-yellow-400" />;
    case 'run_command': return <Terminal size={12} className="text-orange-400" />;
    default: return <Bot size={12} className="text-muted-foreground" />;
  }
}

// ─── Collapsible Step ────────────────────────────────────────────────

function ToolCallItem({ call }: { call: any }) {
  const [expanded, setExpanded] = useState(false);
  const fnName = call.function?.name;
  const fnArgs = typeof call.function?.arguments === 'string' ? JSON.parse(call.function.arguments) : call.function?.arguments;

  return (
    <div className="system-message-block border border-border/10 bg-foreground/[0.02] rounded-lg overflow-hidden mb-1">
      <button 
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-2 py-1 text-[10px] hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <ToolIcon name={fnName} />
          <span className="font-bold uppercase tracking-tight text-muted-foreground/70">{fnName}</span>
        </div>
        <ChevronRight size={10} className={`transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} />
      </button>
      {expanded && (
        <div className="px-2 pb-2 text-[10px] font-mono text-muted-foreground/60 border-t border-border/20 pt-1">
          <pre className="whitespace-pre-wrap">{JSON.stringify(fnArgs, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

function ThoughtBlock({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!content.trim()) return null;

  return (
    <div className="my-2 border-l-2 border-primary/20 bg-primary/5 rounded-r-md overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold tracking-tight uppercase text-primary/60 hover:text-primary/80 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Bot size={12} />
          <span>Thought Process</span>
        </div>
        <ChevronRight size={10} className={`transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} />
      </button>
      {expanded && (
        <div className="px-3 pb-3 text-[11px] leading-relaxed text-muted-foreground/70 italic border-t border-primary/10 pt-2 whitespace-pre-wrap">
          {content}
        </div>
      )}
    </div>
  );
}


function ToolResultMessage({ name, content }: { name?: string; content: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="my-1 border-l-2 border-primary/20 bg-muted/5 rounded-r px-3 py-1.5 overflow-hidden">
      <button 
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between group"
      >
        <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tight">
          <Check size={12} className="text-green-500/80" />
          <span>Result: {name}</span>
        </div>
        <ChevronRight size={10} className={`text-muted-foreground/40 group-hover:text-primary transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} />
      </button>
      {expanded && (
        <pre className="mt-2 text-[10px] font-mono text-muted-foreground/60 whitespace-pre-wrap max-h-96 overflow-auto border-t border-border/10 pt-2">
          {content}
        </pre>
      )}
    </div>
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
    <div className="border border-orange-500/30 bg-orange-500/5 rounded-lg p-3 my-2 space-y-2">
      <div className="flex items-center gap-2 text-orange-400 text-xs font-medium">
        <AlertTriangle size={14} />
        <span>Command Approval Required</span>
      </div>
      <div className="bg-background border border-border rounded-md px-3 py-2">
        <code className="text-xs text-foreground font-mono">{command}</code>
        <div className="text-[10px] text-muted-foreground mt-1">cwd: {cwd}</div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onApprove}
          className="px-3 py-1.5 text-xs rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors font-medium"
        >
          Approve
        </button>
        <button
          onClick={onReject}
          className="px-3 py-1.5 text-xs rounded-md bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors font-medium"
        >
          Reject
        </button>
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
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mb-1 border border-border/20 rounded-md bg-muted/5 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold tracking-tight uppercase text-muted-foreground/50 hover:text-primary/70 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Terminal size={12} />
          <span>System Prompt</span>
        </div>
        <ChevronRight size={10} className={`transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="px-3 pb-3 text-[11px] leading-relaxed text-muted-foreground/60 font-mono whitespace-pre-wrap border-t border-border/20 pt-2">
          {content}
        </div>
      )}
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

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    const lastSession = localStorage.getItem('lastSession');
    if (lastSession) {
      try {
        const { id, date } = JSON.parse(lastSession);
        // @ts-ignore
        window.api.loadChatLog(id, date).then((res: any) => {
          if (res && res.data) {
            // Migration: handle old logs with 'text' field
            const normalized = res.data.map((m: any) => ({
              ...m,
              content: m.content || m.text || ""
            }));
            setMessages(normalized);
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
    return () => {
      delete (window as any).focusChatInput;
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

        const agentConfig: AgentConfig = {
          url: settings.aiConfigs?.ollama?.url || 'http://localhost:11434',
          model: settings.aiConfigs?.ollama?.model || 'deepseek-r1:14b',
          contextWindow: settings.aiConfigs?.ollama?.contextWindow || 8192,
          autoApproveCommands: settings.aiConfigs?.autoApproveCommands || false,
        };

        // 1. Initial System Message
        if (messages.length === 0) {
          const sysPrompt = await getSystemPrompt();
          const sysMsg: AgentMessage = { id: genId(), role: 'system', content: sysPrompt };
          messages.push(sysMsg);
          setMessages([sysMsg]);
        }

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
          const finalHistory = await runAgentLoop(
            promptText,
            history.slice(0, -1),
            agentConfig,
            workspaceFolders,
            (event: AgentStepEvent) => {
              if (event.type === 'approval_request') {
                setPendingApproval({
                  command: event.toolArgs?.command || '',
                  cwd: event.toolArgs?.cwd || '',
                });
              }
            },
            requestApproval,
            abort.signal
          );
          setMessages(finalHistory);
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
    setMessages([]);
    setSessionId(null);
    localStorage.removeItem('lastSession');
    abortRef.current?.abort();
  }, []);
  const copyHistoryAsJson = useCallback(() => {
    const jsonStr = JSON.stringify(messages, null, 2);
    navigator.clipboard.writeText(jsonStr).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => console.error('Failed to copy', err));
  }, [messages]);
  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => console.error('Failed to copy', err));
  }, []);

  const saveMessageToFile = useCallback(async (text: string) => {
    const filename = prompt('Enter filename to save message content:', `ai-message-${Date.now()}.md`);
    if (!filename) return;

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
      <div className="flex-1 overflow-y-auto px-6 pt-10 pb-32 space-y-4 mask-fade-vertical z-10" ref={scrollRef}>
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

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`group/msg relative transition-all duration-300 max-w-4xl mx-auto py-2 rounded-md border border-transparent ${
              msg.role === 'user' ? 'bg-foreground/[0.05] border-border/10 shadow-sm px-4' : ''
            }`}
          >
            <div className="flex flex-col gap-1">
              <div className="text-foreground">
                {msg.role === 'system' ? (
                  <SystemMessage content={msg.content} />
                ) : msg.role === 'assistant' ? (
                  <div className="space-y-2">
                    {/* Handle Thoughts (Explicit field) */}
                    {msg.thinking && <ThoughtBlock content={msg.thinking} />}
                    {/* Handle Inline Thoughts */}
                    {[...msg.content.matchAll(/<thought>([\s\S]*?)<\/thought>/g)].map((m, idx) => (
                      <ThoughtBlock key={idx} content={m[1].trim()} />
                    ))}
                    {/* Handle Content (stripping thoughts) */}
                    {msg.content.replace(/<thought>[\s\S]*?<\/thought>/g, '').trim() && (
                      <div className="py-1">
                        <MessageContent 
                          content={msg.content.replace(/<thought>[\s\S]*?<\/thought>/g, '').trim()} 
                          role="assistant" 
                          onOpenFile={handleOpenFile} 
                        />
                      </div>
                    )}
                    {/* Handle Tool Calls */}
                    {msg.tool_calls?.map((call, idx) => (
                      <ToolCallItem key={idx} call={call} />
                    ))}
                  </div>
                ) : msg.role === 'tool' ? (
                  <ToolResultMessage name={msg.name} content={msg.content} />
                ) : (
                  <div className="flex flex-col gap-2">
                    {msg.thinking && <ThoughtBlock content={msg.thinking} />}
                    {msg.content && (
                      <div className="py-1">
                        <MessageContent content={msg.content} role={msg.role} onOpenFile={handleOpenFile} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Message Actions */}
            {msg.role === 'assistant' && !msg.tool_calls?.length && (
              <div className="flex items-center justify-end gap-1 opacity-0 group-hover/msg:opacity-100 transition-opacity mt-1">
                <button
                  onClick={() => copyToClipboard(msg.content || '')}
                  className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  title="Copy Message"
                >
                  <Copy size={12} />
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Inline Approval Modal */}
        {pendingApproval && (
          <div className="max-w-4xl mx-auto">
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
              <Bot size={10} className="text-primary" />
              <span>{settings.aiProvider || 'gemini'}</span>
              {settings.aiProvider === 'ollama' && (
                <span className="normal-case font-medium opacity-80 border-l border-border/20 pl-2">
                  {settings.aiConfigs?.ollama?.model || 'deepseek-r1:14b'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 pointer-events-auto">
              <button
                onClick={copyHistoryAsJson}
                disabled={messages.length === 0}
                className={`p-1.5 rounded-full backdrop-blur-md border border-border/20 transition-all ${
                  copied 
                    ? 'bg-green-500/20 text-green-500 border-green-500/20' 
                    : 'bg-background/40 hover:bg-primary/10 text-muted-foreground hover:text-primary'
                } ${messages.length === 0 ? 'opacity-0 scale-90 pointer-events-none' : 'opacity-100 scale-100'}`}
                title="Copy conversation as JSON"
              >
                {copied ? <CheckCircle size={12} /> : <Copy size={12} />}
              </button>
              <button
                onClick={clearHistory}
                className={`p-1.5 rounded-full bg-background/40 backdrop-blur-md border border-border/20 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-all ${messages.length === 0 ? 'opacity-0 scale-90 pointer-events-none' : 'opacity-100 scale-100'}`}
                title="Clear History"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>

          <ChatInput
            ref={inputRef}
            onSubmit={sendMessage}
            disabled={loading}
            workspaceFolders={workspaceFolders}
          />
        </div>
      </div>
    </div>
  );
}
