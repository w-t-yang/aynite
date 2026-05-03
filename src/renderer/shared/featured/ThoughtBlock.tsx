import React from 'react';
import { Bot } from 'lucide-react';
import { Collapsible } from '../basic/Collapsible';

interface ThoughtBlockProps {
  content: string;
  defaultExpanded?: boolean;
}

export function ThoughtBlock({ content, defaultExpanded = false }: ThoughtBlockProps) {
  if (!content?.trim()) return null;
  return (
    <Collapsible title="Thinking Process" icon={Bot} colorClass="border-primary/40" defaultExpanded={defaultExpanded}>
      <div className="text-[11px] leading-relaxed text-muted-foreground/80 italic whitespace-pre-wrap">
        {content}
      </div>
    </Collapsible>
  );
}
