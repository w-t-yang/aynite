import React from 'react';
import { Copy } from 'lucide-react';
import { AgentMessage } from '../../src/lib/agent';
import { SettingsState } from '../lib/types';
import { Collapsible } from '../basic/Collapsible';
import { ThoughtBlock } from './ThoughtBlock';
import { MessageContent } from './MessageContent';
import { ToolCallItem } from './ToolCallItem';

interface ChatMessageProps {
  msg: AgentMessage;
  idx: number;
  total: number;
  onOpenFile: (path: string) => void;
  onCopy: (content: string) => void;
  settings: SettingsState;
}

export function ChatMessage({
  msg,
  idx,
  total,
  onOpenFile,
  onCopy,
  settings
}: ChatMessageProps) {
  const isLast = idx === total - 1;

  return (
    <div
      className={`group/msg relative transition-all duration-300 max-w-4xl mx-auto py-1 rounded-sm border border-transparent ${msg.role === 'user' ? 'bg-foreground/[0.03] border-border/5 px-4' : ''
        }`}
    >
      <div className="flex flex-col gap-1">
        <div className="text-foreground text-sm leading-relaxed">
          {msg.role === 'system' ? (
            <Collapsible title="System Prompt" colorClass="border-muted-foreground/30">
              <div className="text-[11px] font-mono text-muted-foreground/70 whitespace-pre-wrap leading-relaxed">
                {msg.content}
              </div>
            </Collapsible>
          ) : msg.role === 'assistant' ? (() => {
            const hasToolCalls = msg.tool_calls && msg.tool_calls.length > 0;
            const hasContent = !!(msg.content || '').replace(/<(?:thought|think)>[\s\S]*?<\/(?:thought|think)>/g, '').trim();

            return (
              <div className="space-y-1.5">
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

                {(msg.content || '').replace(/<(?:thought|think)>[\s\S]*?<\/(?:thought|think)>/g, '').trim() && (
                  <Collapsible
                    title={settings.agents?.list?.find(a => a.id === settings.agents?.activeId)?.name || 'Assistant'}
                    icon={null}
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
                  </Collapsible>
                )}

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
            <Collapsible
              title={`Result: ${msg.name || 'Tool'}`}
              colorClass="border-green-500/40"
              defaultExpanded={isLast}
            >
              <pre className="text-[10px] font-mono whitespace-pre-wrap max-h-96 overflow-auto text-muted-foreground/60">
                {msg.content}
              </pre>
            </Collapsible>
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
