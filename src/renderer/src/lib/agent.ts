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

  // Map fullHistory to CoreMessage format
  const apiMessages = fullHistory.map(m => {
    if (m.role === 'tool' && !m.tool_call_id) {
      return {
        role: 'user',
        content: `[Tool Output: ${m.name || 'unknown'}]\n${m.content}`
      };
    }
    return {
      role: m.role,
      content: m.content,
      ...(m.tool_call_id ? { toolCallId: m.tool_call_id } : {}),
      ...(m.tool_calls ? { toolCalls: m.tool_calls.map(c => ({
        toolCallId: c.toolCallId,
        toolName: c.toolName,
        args: c.args
      })) } : {})
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
      compatibility: config.compatibility
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
          currentAssistantMsg!.thinking += (part.reasoningDelta || part.delta || '');
          onEvent({ type: 'thinking', content: part.reasoningDelta || part.delta || '' });
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
          // Tool results are separate messages in the history
          const resultMsg: AgentMessage = {
            id: genId(),
            role: 'tool',
            content: typeof part.output === 'string' ? part.output : JSON.stringify(part.output || part.result || ''),
            tool_call_id: part.toolCallId,
            name: part.toolName
          };
          
          // Before adding a tool result, we should finalize the preceding assistant message
          finalizeAssistantMsg();
          loopMessages.push(resultMsg);
          
          onEvent({
            type: 'tool_result',
            content: resultMsg.content,
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
