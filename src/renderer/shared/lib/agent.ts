import { ChatMessage, AgentStepEvent } from './types';

export interface AgentConfig {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  compatibility?: 'openai' | 'anthropic' | 'google';
  enabledTools?: { [key: string]: boolean };
  agentPromptFiles?: string[];
}

const genId = () => Math.random().toString(36).slice(2, 11);

export async function runAgentLoop(
  userMessage: string,
  history: ChatMessage[],
  config: AgentConfig,
  workspaceFolders: string[],
  onEvent: (event: AgentStepEvent) => void,
  requestApproval: (command: string, cwd: string) => Promise<boolean>,
  activeFile?: string,
  abortSignal?: AbortSignal
): Promise<ChatMessage[]> {

  const fullHistory: ChatMessage[] = [...history];

  const hasSystem = fullHistory.some(m => m.role === 'system');
  if (!hasSystem) {
    console.log("[Agent] No system prompt found in history, fetching merged prompt for agent files:", config.agentPromptFiles);
    const sysPrompt = await window.aynite.getMergedSystemPrompt(undefined, config.agentPromptFiles);
    console.log("[Agent] Injected system prompt length:", (sysPrompt || "").length);
    const sysMsg: ChatMessage = {
      id: genId(),
      role: 'system',
      content: sysPrompt
    };
    fullHistory.unshift(sysMsg);
  }

  // Helper to check for reasoning content
  const hasReasoning = (m: ChatMessage) => m.thinking || m.content.includes('<thought>') || m.content.includes('<think>');

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
      const availableResults = new Map<string, ChatMessage>();
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
  const userMsg: ChatMessage = { id: genId(), role: 'user', content: userMessage };
  apiMessages.push({ role: 'user', content: userMsg.content });



  console.log("[Agent] Sending messages to backend:", apiMessages.length);

  let requestId;
  try {
    const res = await window.aynite.aiChat({
      messages: apiMessages,
      config: {
        provider: config.provider,
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        model: config.model,
        compatibility: config.compatibility,
        enabledTools: config.enabledTools
      },
      workspaceFolders,
      activeFile
    });
    requestId = res.requestId;
  } catch (error: any) {
    const errorMsg: ChatMessage = { id: genId(), role: 'assistant', content: `❌ **AI Error**: ${error.message}` };
    onEvent({ type: 'error', content: `AI Error: ${error.message}` });
    return [...fullHistory, userMsg, errorMsg];
  }

  return new Promise((fulfill) => {
    const loopMessages: ChatMessage[] = [];
    let currentAssistantMsg: ChatMessage | null = null;
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
    const removeApprovalListener = window.aynite.onAiApprovalRequest(async (data: { id: string, command: string, cwd: string }) => {
      onEvent({
        type: 'approval_request',
        content: `Run command: ${data.command}`,
        toolName: 'run_command',
        toolArgs: { command: data.command, cwd: data.cwd },
        approvalId: data.id,
      });
      const approved = await requestApproval(data.command, data.cwd);
      window.aynite.respondToAiApproval(data.id, approved);
    });

    const removeDeltaListener = window.aynite.onAiChatDelta(requestId, (part: any) => {
      if (abortSignal?.aborted) {
        removeDeltaListener();
        removeApprovalListener();
        onEvent({ type: 'error', content: 'Request aborted.' });
        finalizeAssistantMsg();
        fulfill([...fullHistory, userMsg, ...loopMessages]);
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
          const resultMsg: ChatMessage = {
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
          const errorMsg: ChatMessage = {
            id: genId(),
            role: 'assistant',
            content: `❌ **AI Stream Error**: ${part.error || part.message || 'Unknown stream error'}`
          };
          fulfill([...fullHistory, userMsg, ...loopMessages, errorMsg]);
          break;

        case 'finish':
          removeDeltaListener();
          removeApprovalListener();
          finalizeAssistantMsg();
          fulfill([...fullHistory, userMsg, ...loopMessages]);
          break;
      }
    });
  });
}
