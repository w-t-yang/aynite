export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
  thinking?: string;
}

export interface AgentStepEvent {
  type: 'thinking' | 'tool_call' | 'tool_result' | 'text_delta' | 'text_done' | 'error' | 'approval_request';
  content: string;
  toolName?: string;
  toolArgs?: Record<string, any>;
  toolCallId?: string;
  approvalId?: string;
}

export interface AgentConfig {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  compatibility?: 'openai' | 'anthropic' | 'google';
  autoApproveCommands?: boolean;
  thinking?: boolean;
  thinkingBudget?: number;
}

const genId = () => Math.random().toString(36).slice(2, 11);

export async function runAgentLoop(
  userMessage: string,
  history: AgentMessage[],
  config: AgentConfig,
  workspaceFolders: string[],
  onEvent: (event: AgentStepEvent) => void,
  requestApproval: (command: string, cwd: string) => Promise<boolean>,
  abortSignal?: AbortSignal
): Promise<AgentMessage[]> {

  const fullHistory: AgentMessage[] = [...history];

  const hasSystem = fullHistory.some(m => m.role === 'system');
  if (!hasSystem) {
    console.log("[Agent] No system prompt found in history, fetching merged prompt...");
    // @ts-ignore
    const sysPromptRes = await window.api.getMergedSystemPrompt();
    const sysPrompt = (sysPromptRes && sysPromptRes.data) ? sysPromptRes.data : "";
    console.log("[Agent] Injected system prompt length:", sysPrompt.length);
    const sysMsg: AgentMessage = {
      id: genId(),
      role: 'system',
      content: sysPrompt
    };
    fullHistory.unshift(sysMsg);
  }

  // Helper to check for reasoning content
  const hasReasoning = (m: AgentMessage) => m.thinking || m.content.includes('<thought>') || m.content.includes('<think>');

  /**
   * AI SDK v6 turns are very strict:
   * Assistant [calls] -> Tool Results [all matching] -> (Next turn)
   * We must ensure no other messages (user/assistant) interleave between calls and results.
   */
  const cleanMessages: any[] = [];
  
  for (let i = 0; i < fullHistory.length; i++) {
    const m = fullHistory[i];

    // --- CASE A: USER / SYSTEM / TOOL (orphaned) ---
    if (m.role === 'user' || m.role === 'system') {
      cleanMessages.push({ role: m.role, content: m.content || '' });
      continue;
    }

    if (m.role === 'tool') {
      // Orphaned tool results (not immediately following an assistant call) are generally invalid for the SDK
      // We'll skip them to keep the history clean, or map to user if they have important content
      continue; 
    }

    // --- CASE B: ASSISTANT ---
    if (m.role === 'assistant') {
      const parts: any[] = [];
      
      // 1. Thinking / Text
      if (hasReasoning(m)) {
        parts.push({
          type: 'reasoning',
          text: m.thinking || m.content.match(/<(?:thought|think)>([\s\S]*?)<\/(?:thought|think)>/)?.[1] || ''
        });
      }
      const cleanContent = m.content.replace(/<(?:thought|think)>[\s\S]*?<\/(?:thought|think)>/g, '').trim();
      if (cleanContent) {
        parts.push({ type: 'text', text: cleanContent });
      }

      // 2. Identify available results that IMMEDIATELY follow this message
      const availableResults = new Map<string, AgentMessage>();
      let j = i + 1;
      while (j < fullHistory.length && fullHistory[j].role === 'tool') {
        const toolMsg = fullHistory[j];
        if (toolMsg.tool_call_id) {
          availableResults.set(toolMsg.tool_call_id, toolMsg);
        }
        j++;
      }

      // 3. Filter tool calls: only keep those that have a matching result in the immediate next block
      const validCalls: any[] = [];
      if (m.tool_calls && m.tool_calls.length > 0) {
        for (const c of m.tool_calls) {
          if (c.toolCallId && availableResults.has(c.toolCallId)) {
            validCalls.push(c);
            parts.push({
              type: 'tool-call',
              toolCallId: c.toolCallId,
              toolName: c.toolName,
              input: typeof c.args === 'string' ? JSON.parse(c.args) : c.args
            });
          }
        }
      }

      // 4. Map the assistant message
      if (parts.length > 0) {
        cleanMessages.push({
          role: 'assistant',
          content: parts.length === 1 && parts[0].type === 'text' ? parts[0].text : parts
        });
        
        // 5. Append the matching tool results immediately after
        for (const c of validCalls) {
          const res = availableResults.get(c.toolCallId)!;
          cleanMessages.push({
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: c.toolCallId,
                toolName: c.toolName,
                output: { type: 'text', value: res.content || '' }
              }
            ]
          });
        }
      } else {
        // Fallback for interrupted assistant messages with no content and no valid calls
        cleanMessages.push({ role: 'assistant', content: '(Interrupted)' });
      }

      // Skip the tool results we just processed
      i = j - 1;
    }
  }

  const apiMessages = cleanMessages;
  const userMsg: AgentMessage = { id: genId(), role: 'user', content: userMessage };
  apiMessages.push({ role: 'user', content: userMsg.content });



  console.log("[Agent] Sending messages to backend:", apiMessages.length);

  // @ts-ignore
  const { requestId, error } = await window.api.aiChat({
    messages: apiMessages,
    config: {
      provider: config.provider,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
      autoApproveCommands: config.autoApproveCommands,
      compatibility: config.compatibility,
      thinking: config.thinking,
      thinkingBudget: config.thinkingBudget
    },
    workspaceFolders
  });

  if (error) {
    const errorMsg: AgentMessage = { id: genId(), role: 'assistant', content: `❌ **AI Error**: ${error}` };
    onEvent({ type: 'error', content: `AI Error: ${error}` });
    return [...fullHistory, userMsg, errorMsg];
  }

  return new Promise((resolve) => {
    const loopMessages: AgentMessage[] = [];
    let currentAssistantMsg: AgentMessage | null = null;
    const currentToolCalls: any[] = [];

    const finalizeAssistantMsg = () => {
      if (currentAssistantMsg) {
        currentAssistantMsg.tool_calls = [...currentToolCalls];
        loopMessages.push(currentAssistantMsg);
        currentAssistantMsg = null;
        currentToolCalls.length = 0;
      }
    };

    const ensureAssistantMsg = () => {
      if (!currentAssistantMsg) {
        currentAssistantMsg = { 
          id: genId(), 
          role: 'assistant', 
          content: '', 
          thinking: '',
          tool_calls: [] 
        };
      }
    };

    // Listen for approval requests
    // @ts-ignore
    const removeApprovalListener = window.api.onAiApprovalRequest(async (data: { id: string, command: string, cwd: string }) => {
      onEvent({
        type: 'approval_request',
        content: `Run command: ${data.command}`,
        toolName: 'run_command',
        toolArgs: { command: data.command, cwd: data.cwd },
        approvalId: data.id,
      });
      const approved = await requestApproval(data.command, data.cwd);
      // @ts-ignore
      window.api.sendAiApprovalResponse({ id: data.id, approved });
    });

    // @ts-ignore
    const removeDeltaListener = window.api.onAiChatDelta(requestId, (part: any) => {
      if (abortSignal?.aborted) {
        removeDeltaListener();
        removeApprovalListener();
        onEvent({ type: 'error', content: 'Request aborted.' });
        finalizeAssistantMsg();
        resolve([...fullHistory, userMsg, ...loopMessages]);
        return;
      }

      switch (part.type) {
        case 'text-delta':
          ensureAssistantMsg();
          currentAssistantMsg!.content += (part.text || '');
          onEvent({ type: 'text_delta', content: part.text || '' });
          break;

        case 'reasoning-delta':
          ensureAssistantMsg();
          const reasoning = part.text || '';  // TextStreamPart 'reasoning-delta' uses the 'text' field
          currentAssistantMsg!.thinking += reasoning;
          onEvent({ type: 'thinking', content: reasoning });
          break;

        case 'tool-call':
          ensureAssistantMsg();
          const call = {
            toolName: part.toolName,
            args: part.input || part.args,
            toolCallId: part.toolCallId,
          };
          currentToolCalls.push(call);
          onEvent({
            type: 'tool_call',
            content: `Calling ${part.toolName}`,
            toolName: part.toolName,
            toolArgs: call.args,
            toolCallId: part.toolCallId,
          });
          break;

        case 'tool-result':
          // Extract the actual result string from the output object (v6) or result field
          let resultValue = '';
          if (typeof part.output === 'string') {
            resultValue = part.output;
          } else if (part.output && typeof part.output === 'object') {
            resultValue = part.output.value || JSON.stringify(part.output);
          } else {
            resultValue = part.result || JSON.stringify(part || '');
          }

          // Tool results are separate messages in the history
          const resultMsg: AgentMessage = {
            id: genId(),
            role: 'tool',
            content: resultValue,
            tool_call_id: part.toolCallId,
            name: part.toolName
          };
          
          // Before adding a tool result, we should finalize the preceding assistant message
          finalizeAssistantMsg();
          loopMessages.push(resultMsg);
          
          onEvent({
            type: 'tool_result',
            content: resultValue,
            toolName: part.toolName,
            toolCallId: part.toolCallId,
          });
          break;


        case 'step-finish':
          finalizeAssistantMsg();
          break;

        case 'error':
          removeDeltaListener();
          removeApprovalListener();
          onEvent({ type: 'error', content: part.error || part.message || 'Unknown stream error' });
          finalizeAssistantMsg();
          const errorMsg: AgentMessage = { 
            id: genId(), 
            role: 'assistant', 
            content: `❌ **AI Stream Error**: ${part.error || part.message || 'Unknown stream error'}` 
          };
          resolve([...fullHistory, userMsg, ...loopMessages, errorMsg]);
          break;

        case 'finish':
          removeDeltaListener();
          removeApprovalListener();
          finalizeAssistantMsg();
          resolve([...fullHistory, userMsg, ...loopMessages]);
          break;
      }
    });
  });
}
