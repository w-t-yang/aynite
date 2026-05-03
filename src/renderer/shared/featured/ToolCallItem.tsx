import React from 'react';
import { Bot, FileText, Save, FolderOpen, Terminal } from 'lucide-react';
import { Collapsible } from '../basic/Collapsible';
import { cn } from '../lib/utils';

const isErrorMessage = (content: any) => {
  if (!content) return false;
  const c = typeof content === 'string' ? content.trim() : JSON.stringify(content);
  return c.startsWith('Error:') || c.startsWith('Execution Error:') || c.startsWith('❌') || c.includes('"status": "error"');
};

interface ToolCallItemProps {
  call: any;
  defaultExpanded?: boolean;
}

export function ToolCallItem({ call, defaultExpanded = false }: ToolCallItemProps) {
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
    <Collapsible title={toolName} icon={Icon} colorClass={colorClass} defaultExpanded={defaultExpanded}>
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
    </Collapsible>
  );
}
