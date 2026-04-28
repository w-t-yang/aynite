import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, RefreshCw, Trash2, ChevronDown, ChevronRight, Terminal, FileText, FolderOpen, AlertTriangle, CheckCircle, XCircle, Copy } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SettingsState } from './Settings';
import ChatInput, { ChatInputHandle } from './ChatInput';
import { runAgentLoop, AgentMessage, AgentStepEvent, AgentConfig } from '../lib/agent';

// ─── Message Types ───────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  // Agent activity steps (tool calls, results, approvals)
  steps?: AgentStep[];
}

interface AgentStep {
  id: string;
  type: 'tool_call' | 'tool_result' | 'approval_request' | 'error' | 'text';
  content: string;
  toolName?: string;
  toolArgs?: Record<string, any>;
  status?: 'pending' | 'done' | 'error' | 'approved' | 'rejected';
}

// ─── Tool Icons ──────────────────────────────────────────────────────

function ToolIcon({ name }: { name?: string }) {
  switch (name) {
    case 'read_file': return <FileText size={12} className="text-blue-400" />;
    case 'write_file': return <FileText size={12} className="text-green-400" />;
    case 'list_files': return <FolderOpen size={12} className="text-yellow-400" />;
    case 'run_command': return <Terminal size={12} className="text-orange-400" />;
    default: return <Bot size={12} className="text-muted-foreground" />;
  }
}

// ─── Collapsible Step ────────────────────────────────────────────────

function StepEntry({ step }: { step: AgentStep }) {
  const [expanded, setExpanded] = useState(false);

  const statusIcon = step.status === 'done' ? <CheckCircle size={10} className="text-green-500" />
    : step.status === 'error' || step.status === 'rejected' ? <XCircle size={10} className="text-red-500" />
    : step.status === 'pending' ? <RefreshCw size={10} className="animate-spin text-blue-400" />
    : step.status === 'approved' ? <CheckCircle size={10} className="text-green-500" />
    : null;

  return (
    <div className="border border-border/30 rounded-md overflow-hidden my-1 bg-accent/10">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-muted-foreground hover:bg-accent/20 transition-colors"
      >
        {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        <ToolIcon name={step.toolName} />
        <span className="font-medium truncate flex-1 text-left">
          {step.type === 'tool_call' ? `${step.toolName}` : step.type === 'tool_result' ? `Result` : step.type}
          {step.toolArgs?.path ? ` → ${step.toolArgs.path.split('/').pop()}` : ''}
          {step.toolArgs?.command ? ` → ${step.toolArgs.command}` : ''}
        </span>
        {statusIcon}
      </button>
      {expanded && (
        <div className="px-3 py-2 text-[11px] border-t border-border/20 bg-background/50 max-h-48 overflow-y-auto">
          <pre className="whitespace-pre-wrap break-words font-mono text-foreground/80">{step.content}</pre>
        </div>
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

// ─── Message Rendering with Mentions ────────────────────────────────

function MessageContent({ text, role, onOpenFile }: { text: string; role: 'user' | 'model', onOpenFile?: (path: string) => void }) {
  if (role === 'model') {
    // Process <think> or <thought> blocks
    let processedText = text;
    const thinkRegex = /<(think|thought)>([\s\S]*?)<\/\1>/g;
    processedText = processedText.replace(thinkRegex, (match, tag, p1) => {
      return `\n<details>\n<summary><b>Thinking Process</b></summary>\n\n${p1.trim()}\n\n</details>\n\n`;
    });
    
    if (processedText.includes('<think>') && !processedText.includes('</think>')) {
      const parts = processedText.split('<think>');
      processedText = parts[0] + `\n<details open>\n<summary><b>Thinking...</b></summary>\n\n${parts[1].trim()}\n\n</details>\n\n`;
    } else if (processedText.includes('<thought>') && !processedText.includes('</thought>')) {
      const parts = processedText.split('<thought>');
      processedText = parts[0] + `\n<details open>\n<summary><b>Thinking...</b></summary>\n\n${parts[1].trim()}\n\n</details>\n\n`;
    }

    const parts = [];
    let lastPos = 0;
    const viewRegex = /\[\[View:(.*?)\]\]/g;
    let match;

    while ((match = viewRegex.exec(processedText)) !== null) {
      if (match.index > lastPos) {
        parts.push(<Markdown key={`md-${lastPos}`} remarkPlugins={[remarkGfm]}>{processedText.substring(lastPos, match.index)}</Markdown>);
      }
      const path = match[1];
      parts.push(
        <button
          key={`view-${match.index}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onOpenFile?.(path);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-md text-xs font-medium transition-all my-2 group"
        >
          <FileText size={14} className="group-hover:scale-110 transition-transform" /> 
          <span>View Definition</span>
        </button>
      );
      lastPos = viewRegex.lastIndex;
    }

    if (lastPos < processedText.length) {
      parts.push(<Markdown key={`md-${lastPos}`} remarkPlugins={[remarkGfm]}>{processedText.substring(lastPos)}</Markdown>);
    }

    return (
      <div className="markdown-body prose prose-sm dark:prose-invert max-w-none break-words">
        {parts}
      </div>
    );
  }

  // Pre-process user message to render mentions as rich tags
  const parts = [];
  let lastIndex = 0;
  
  // Regex to match our serialized mention formats
  // @file[label](id), /skill[label](id), >cmd[label](id)
  const mentionRegex = /(@file|\/skill|>cmd)\[(.*?)\]\((.*?)\)/g;
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    const type = match[1];
    const label = match[2];
    const id = match[3];

    // Map type to class
    let className = 'mention';
    if (type === '@file') className += ' mention-file';
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
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return <div className="whitespace-pre-wrap">{parts}</div>;
}

// ─── Main Chat Component ─────────────────────────────────────────────

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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
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
    (window as any).focusChatInput = () => {
      inputRef.current?.focus();
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
      if (!text.trim()) return;

      const userMsgId = genId();
      const userMsg: ChatMessage = { id: userMsgId, role: 'user', text };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      // Handle direct lookup if message ends with ?
      // Format: /skill[label](id)? or >cmd[label](id)?
      const trimmed = text.trim();
      if (trimmed.endsWith('?')) {
        const skillMatch = trimmed.match(/^\/skill\[(.*?)\]\((.*?)\)\s*\?$/);
        const cmdMatch = trimmed.match(/^>cmd\[(.*?)\]\((.*?)\)\s*\?$/);

        if (skillMatch || cmdMatch) {
          const type = skillMatch ? 'skill' : 'command';
          const name = (skillMatch || cmdMatch)![1];
          
          try {
            // @ts-ignore
            const res = type === 'skill' ? await window.api.getAvailableSkills() : await window.api.getAvailableCommands();
            if (res.data) {
               const item = res.data.find((i: any) => i.name === name);
               if (item) {
                 const mdPath = type === 'skill' ? `${item.path}/SKILL.md` : `${item.path}/COMMAND.md`;
                 setMessages((prev) => [...prev, {
                   id: genId(),
                   role: 'model',
                   text: `### ${type === 'skill' ? 'Skill' : 'Command'}: ${name}\n\n${item.description || 'No description provided.'}\n[[View:${mdPath}]]`
                 }]);
                 setLoading(false);
                 return;
               }
            }
          } catch (e) {
            console.error('Lookup error', e);
          }
        }
      }

      // Handle Direct Command Execution (if not a lookup)
      const commandMentionRegex = />cmd\[(.*?)\]\((.*?)\)/g;
      const cmdMatches = [...text.matchAll(commandMentionRegex)];
      
      if (cmdMatches.length > 0) {
        // 1. Multiple commands check
        if (cmdMatches.length > 1) {
          setMessages((prev) => [...prev, {
            id: genId(),
            role: 'model',
            text: `⚠️ **Error**: Multiple commands detected. Please provide only one command at a time.`
          }]);
          setLoading(false);
          return;
        }

        const match = cmdMatches[0];
        const textBefore = text.substring(0, match.index!).trim();
        
        // 2. Leading text check
        if (textBefore.length > 0) {
          setMessages((prev) => [...prev, {
            id: genId(),
            role: 'model',
            text: `⚠️ **Error**: Please start your message with the command mention. Standard text before commands is not allowed.`
          }]);
          setLoading(false);
          return;
        }

        const cmdName = match[1];
        const cmdPath = match[2];
        const trailingText = text.substring(match.index! + match[0].length).trim();
        
        try {
          // @ts-ignore
          const res = await window.api.getAvailableCommands();
          const cmdMeta = res.data?.find((c: any) => c.name === cmdName || c.path === cmdPath);
          
          if (cmdMeta) {
            // 3. Parameter validation
            const requiredParams = (cmdMeta.parameters || []).filter((p: any) => p.required);
            
            // For now, we treat the trailing text as the first required parameter if provided.
            // In the future, we might support named parameters.
            if (requiredParams.length > 0 && !trailingText) {
              setMessages((prev) => [...prev, {
                id: genId(),
                role: 'model',
                text: `⚠️ **Required Parameter Missing**: This command expects parameters.\n\n**Example**: ${cmdMeta.example || `>${cmdName} some-value`}`
              }]);
              setLoading(false);
              return;
            }

            // 4. Execution
            // Split trailingText by whitespace into separate parameters, but preserve quotes if we were to support them.
            // For now, a simple split handles @file and --flags correctly.
            const params = trailingText.split(/\s+/).filter(Boolean);
            // @ts-ignore
            const runRes = await window.api.runDirectCommand({ 
              commandPath: cmdMeta.path, 
              params, 
              currentFile: activeTabPath 
            });

            if (runRes.error) {
              const output = [runRes.stdout, runRes.data?.stdout, runRes.stderr, runRes.data?.stderr].filter(Boolean).join('\n').trim();
              setMessages((prev) => [...prev, {
                id: genId(),
                role: 'model',
                text: `❌ **Command Failure**\n\n${output ? `\`\`\`\n${output}\n\`\`\`` : `*${runRes.error}*`}`
              }]);
            } else {
              setMessages((prev) => [...prev, {
                id: genId(),
                role: 'model',
                text: `✅ **Results**:\n${runRes.data?.stdout || 'Command completed with no output.'}`
              }]);
            }
            setLoading(false);
            return;
          }
        } catch (e: any) {
          setMessages((prev) => [...prev, {
            id: genId(),
            role: 'model',
            text: `❌ **System Error**: ${e.message}`
          }]);
          setLoading(false);
          return;
        }
      }

      const provider = settings.aiProvider || 'gemini';

      // WIP for non-ollama providers
      if (provider === 'gemini' || provider === 'deepseek') {
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            {
              id: genId(),
              role: 'model',
              text: `[WIP] The integration for **${provider}** is currently a work in progress.`,
            },
          ]);
          setLoading(false);
        }, 500);
        return;
      }

      // Ollama agent flow
      const modelMsgId = genId();
      const agentConfig: AgentConfig = {
        url: settings.aiConfigs?.ollama?.url || 'http://localhost:11434',
        model: settings.aiConfigs?.ollama?.model || 'deepseek-r1:14b',
        contextWindow: settings.aiConfigs?.ollama?.contextWindow || 8192,
        autoApproveCommands: settings.aiConfigs?.autoApproveCommands || false,
      };

      // 5. Extract Skills from history and current text
      const skillMentionRegex = /\/skill\[(.*?)\]\((.*?)\)/g;
      const skillPaths = new Set<string>();
      
      // Search in current message
      const currentMatches = [...text.matchAll(skillMentionRegex)];
      currentMatches.forEach(m => skillPaths.add(m[2]));
      
      // Search in history
      messages.forEach(msg => {
        const matches = [...msg.text.matchAll(skillMentionRegex)];
        matches.forEach(m => skillPaths.add(m[2]));
      });

      let skillContext = "";
      if (skillPaths.size > 0) {
        const skillsData = await Promise.all([...skillPaths].map(async (sp) => {
          try {
            // @ts-ignore
            const res = await window.api.readFile(`${sp}/SKILL.md`);
            if (!res.data) return "";
            const skillName = sp.split(/[/\\]/).filter(Boolean).pop() || sp;
            return `<skill name="${skillName}">\n${res.data}\n</skill>`;
          } catch { return ""; }
        }));
        skillContext = skillsData.filter(Boolean).join("\n\n");
      }

      // Build history from existing messages, masking the skill paths from the agent
      const history: AgentMessage[] = messages.flatMap((m): AgentMessage[] => {
        const cleanContent = m.text.replace(skillMentionRegex, '[Skill: $1]');
        if (m.role === 'user') return [{ role: 'user' as const, content: cleanContent }];
        if (m.role === 'model') return [{ role: 'assistant' as const, content: cleanContent }];
        return [];
      });

      const steps: AgentStep[] = [];
      let modelText = '';

      // Create an in-progress model message
      setMessages((prev) => [...prev, { id: modelMsgId, role: 'model', text: '', steps: [] }]);

      const abort = new AbortController();
      abortRef.current = abort;

      try {
        const cleanText = text.replace(skillMentionRegex, '[Skill: $1]');
        await runAgentLoop(
          cleanText,
          history,
          agentConfig,
          workspaceFolders,
          (event: AgentStepEvent) => {
            switch (event.type) {
              case 'tool_call': {
                const step: AgentStep = {
                  id: event.toolCallId || genId(),
                  type: 'tool_call',
                  content: JSON.stringify(event.toolArgs, null, 2),
                  toolName: event.toolName,
                  toolArgs: event.toolArgs,
                  status: 'pending',
                };
                steps.push(step);
                setMessages((prev) =>
                  prev.map((m) => (m.id === modelMsgId ? { ...m, steps: [...steps] } : m))
                );
                break;
              }
              case 'tool_result': {
                // Update the matching step to 'done'
                const existingStep = steps.find((s) => s.id === event.toolCallId);
                if (existingStep) {
                  existingStep.status = event.content.startsWith('Error') ? 'error' : 'done';
                }
                const resultStep: AgentStep = {
                  id: genId(),
                  type: 'tool_result',
                  content: event.content,
                  toolName: event.toolName,
                  status: event.content.startsWith('Error') ? 'error' : 'done',
                };
                steps.push(resultStep);
                setMessages((prev) =>
                  prev.map((m) => (m.id === modelMsgId ? { ...m, steps: [...steps] } : m))
                );
                break;
              }
              case 'text_delta': {
                // Determine if we need to append to an existing text step
                const lastStep = steps[steps.length - 1];
                if (lastStep && lastStep.type === 'text') {
                  lastStep.content += event.content;
                } else {
                  steps.push({ id: genId(), type: 'text', content: event.content });
                }
                modelText += event.content;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === modelMsgId ? { ...m, text: modelText, steps: [...steps] } : m
                  )
                );
                break;
              }
              case 'text_done': {
                const lastStep = steps[steps.length - 1];
                if (lastStep && lastStep.type === 'text') {
                  lastStep.content = event.content;
                } else {
                  steps.push({ id: genId(), type: 'text', content: event.content });
                }
                modelText = event.content;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === modelMsgId ? { ...m, text: modelText, steps: [...steps] } : m
                  )
                );
                break;
              }
              case 'error': {
                const errorStep: AgentStep = {
                  id: genId(),
                  type: 'error',
                  content: event.content,
                  status: 'error',
                };
                steps.push(errorStep);
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === modelMsgId ? { ...m, text: modelText || event.content, steps: [...steps] } : m
                  )
                );
                break;
              }
            }
          },
          requestApproval,
          abort.signal,
          skillContext
        );
      } catch (err: any) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === modelMsgId ? { ...m, text: `Error: ${err.message}` } : m
          )
        );
      } finally {
        setLoading(false);
        abortRef.current = null;
        
        // Focus back on the chatbox after response is done, 
        // unless the user has moved focus to something else (like an editor or sidebar)
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
    abortRef.current?.abort();
  }, []);

  const copyHistoryAsJson = useCallback(() => {
    const jsonStr = JSON.stringify(messages, null, 2);
    navigator.clipboard.writeText(jsonStr).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => console.error('Failed to copy', err));
  }, [messages]);

  return (
    <div className="chat-panel flex flex-col h-full bg-background">
      {/* Message Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6" ref={scrollRef}>
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
            className={`flex gap-4 max-w-4xl mx-auto ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'model' && (
              <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center shrink-0">
                <Bot size={18} />
              </div>
            )}

            <div
              className={`rounded-xl max-w-[85%] ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-none px-4 py-3'
                  : 'bg-accent/40 rounded-tl-none border border-border/50 text-foreground'
              }`}
            >
              {/* Agent Steps & Text Interleaved */}
              {msg.steps && msg.steps.length > 0 && msg.role === 'model' ? (
                <div className="space-y-1">
                  {msg.steps.map((step) => {
                    // @ts-ignore
                    if (step.type === 'text') {
                      if (!step.content.trim()) return null;
                      return (
                        <div key={step.id} className="px-4 py-3">
                          <MessageContent text={step.content} role="model" onOpenFile={handleOpenFile} />
                        </div>
                      );
                    }
                    return (
                      <div key={step.id} className="px-3 pt-2 pb-1">
                        <StepEntry step={step} />
                      </div>
                    );
                  })}
                </div>
              ) : (
                msg.text && (
                  <div className={msg.role === 'model' ? 'px-4 py-3' : ''}>
                    <MessageContent text={msg.text} role={msg.role} onOpenFile={handleOpenFile} />
                  </div>
                )
              )}
            </div>

            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-gray-600 text-white flex items-center justify-center shrink-0">
                <User size={18} />
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
            <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center shrink-0">
              <RefreshCw size={18} className="animate-spin" />
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="px-4 py-2 flex items-center justify-between border-t border-border bg-accent/5">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
          <Bot size={12} />
          <span>{settings.aiProvider || 'gemini'}</span>
          {settings.aiProvider === 'ollama' && (
            <span className="normal-case font-medium opacity-80 border-l border-border pl-2">
              {settings.aiConfigs?.ollama?.model || 'deepseek-r1:14b'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copyHistoryAsJson}
            disabled={messages.length === 0}
            className={`flex items-center gap-1.5 px-2 py-1 rounded transition-all text-[10px] font-medium ${
              copied 
                ? 'bg-green-500/10 text-green-500' 
                : 'hover:bg-blue-500/10 hover:text-blue-500 text-muted-foreground'
            } ${messages.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
            title="Copy conversation as JSON"
          >
            {copied ? <CheckCircle size={12} /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy JSON'}
          </button>
          <button
            onClick={clearHistory}
            className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-red-500/10 hover:text-red-500 text-muted-foreground transition-all text-[10px] font-medium"
          >
            <Trash2 size={12} />
            Clear History
          </button>
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-border">
        <div className="max-w-4xl mx-auto">
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
