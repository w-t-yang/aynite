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

  // Map fullHistory to CoreMessage format for AI SDK v6 (Agentic version)
  const apiMessages = fullHistory.map(m => {
    // 1. Tool result message
    if (m.role === 'tool') {
      if (!m.tool_call_id) {
        return {
          role: 'user' as const,
          content: `[Tool Output: ${m.name || 'unknown'}]\n${m.content || ''}`
        };
      }
      return {
        role: 'tool' as const,
        content: [
          {
            type: 'tool-result',
            toolCallId: m.tool_call_id,
            toolName: m.name || 'unknown',
            // AI SDK v6 uses 'output' with a type union
            output: {
              type: 'text',
              value: m.content || ''
            }
          }
        ]
      };
    }

    // 2. Assistant message
    if (m.role === 'assistant') {
      const parts: any[] = [];
      
      // Add thinking (reasoning) if present
      if (m.thinking) {
        parts.push({ 
          type: 'reasoning', 
          text: m.thinking // AI SDK v6 uses 'text' for reasoning parts
        });
      }
      
      // Add text content if present
      if (m.content) {
        parts.push({ type: 'text', text: m.content });
      }

      // Add tool calls as parts
      if (m.tool_calls && m.tool_calls.length > 0) {
        m.tool_calls.forEach(c => {
          parts.push({
            type: 'tool-call',
            toolCallId: c.toolCallId,
            toolName: c.toolName,
            // AI SDK v6 uses 'input' for tool calls
            input: typeof c.args === 'string' ? JSON.parse(c.args) : c.args
          });
        });
      }

      // If only text, return as string for better compatibility
      if (parts.length === 1 && parts[0].type === 'text') {
        return { role: 'assistant' as const, content: parts[0].text };
      }

      // Fallback: if no parts, use empty string content
      if (parts.length === 0) {
        return { role: 'assistant' as const, content: '' };
      }

      return {
        role: 'assistant' as const,
        content: parts
      };
    }

    // 3. User and System messages
    return {
      role: m.role as any,
      content: m.content || ''
    };
  });


  const userMsg: AgentMessage = { id: genId(), role: 'user', content: userMessage };
  apiMessages.push({ role: 'user', content: userMessage });

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
          currentAssistantMsg!.content += (part.text || part.textDelta || part.delta || '');
          onEvent({ type: 'text_delta', content: part.text || part.textDelta || part.delta || '' });
          break;

        case 'reasoning-delta':
          ensureAssistantMsg();
          const reasoning = part.reasoning || part.reasoningDelta || part.delta || part.text || '';
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
