import React, { useState } from 'react';
import { Bot, ChevronRight, FileText } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ThinkingProcessProps {
  content: string;
  defaultOpen?: boolean;
}

function ThinkingProcess({ content, defaultOpen = false }: ThinkingProcessProps) {
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

interface MessageContentProps {
  content?: string;
  role: string;
  onOpenFile?: (path: string) => void;
}

export function MessageContent({ content = '', role, onOpenFile }: MessageContentProps) {
  if (role === 'assistant' || role === 'model') {
    const parts = [];
    let currentPos = 0;
    const combinedRegex = /<(think|thought)>([\s\S]*?)(?:<\/\1>|$)|\[\[View:(.*?)\]\]/g;
    let match;

    while ((match = combinedRegex.exec(content)) !== null) {
      if (match.index > currentPos) {
        parts.push(<Markdown key={`md-${currentPos}`} remarkPlugins={[remarkGfm]}>{content.substring(currentPos, match.index)}</Markdown>);
      }

      if (match[1]) {
        parts.push(
          <ThinkingProcess
            key={`think-${match.index}`}
            content={match[2].trim()}
            defaultOpen={false}
          />
        );
      } else if (match[3]) {
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

  const parts = [];
  let lastIndex = 0;
  const mentionRegex = /(@file|@dir|\/skill|>cmd)\[(.*?)\]\((.*?)\)/g;
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.substring(lastIndex, match.index));
    }

    const type = match[1];
    const label = match[2];
    const id = match[3];

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

  if (lastIndex < content.length) {
    parts.push(content.substring(lastIndex));
  }

  return <div className="whitespace-pre-wrap">{parts}</div>;
}
