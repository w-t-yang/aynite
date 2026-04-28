// ─── Agent Loop for Ollama Tool Calling ──────────────────────────────
//
// Implements an agentic loop that sends messages to Ollama's /api/chat
// with tool definitions. When the model returns tool_calls, we execute
// them locally and send results back until the model produces a final
// text response.

export interface AgentMessage {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  // For tool call requests (assistant role)
  tool_calls?: any[];
  // For tool result messages (tool role)
  tool_call_id?: string;
  name?: string;
}

export interface ToolCall {
  id: string;
  function: {
    name: string;
    arguments: Record<string, any>;
  };
}

export interface AgentStepEvent {
  type: 'thinking' | 'tool_call' | 'tool_result' | 'text_delta' | 'text_done' | 'error' | 'approval_request';
  content: string;
  toolName?: string;
  toolArgs?: Record<string, any>;
  toolCallId?: string;
  // For approval requests
  approvalId?: string;
}

// ─── Tool Definitions (Ollama format) ────────────────────────────────

const AGENT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'read_file',
      description: 'Read the contents of a file. Use this to inspect source code. Do NOT use this for skills, as their content is already provided in your system context. Provide the full absolute path.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute path to the file' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'write_file',
      description: 'Write content to a file. Provide the full absolute path. When creating scripts, ALWAYS include a main block and imports.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute path to the file' },
          content: { type: 'string', description: 'Full content to write' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_files',
      description: 'List files in a directory to understand the project structure. Provide the full absolute path.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute path to the directory' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'run_command',
      description: 'Execute a shell command. Provide the command and optionally the directory (cwd) to run in.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The shell command' },
          cwd: { type: 'string', description: 'Directory to run in' },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_codebase',
      description: 'Search for text patterns using grep. Provide the query and the absolute path to search.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search term' },
          path: { type: 'string', description: 'Absolute path to search' },
          isRegex: { type: 'boolean', description: 'True if regex' }
        },
        required: ['query', 'path'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'spawn_subagent',
      description: 'Delegate a complex task to another instance. Return its summary here.',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Instructions for the subagent' },
        },
        required: ['prompt'],
      },
    },
  },
];

// ─── Path Security ───────────────────────────────────────────────────

function isPathWithinWorkspace(filePath: string, workspaceFolders: string[]): boolean {
  // Normalize path separators
  const normalized = filePath.replace(/\\/g, '/');
  return workspaceFolders.some((folder) => {
    const normalizedFolder = folder.replace(/\\/g, '/');
    return normalized.startsWith(normalizedFolder + '/') || normalized === normalizedFolder;
  });
}

// ─── Tool Executors ──────────────────────────────────────────────────

async function executeReadFile(args: { path: string }, workspaceFolders: string[]): Promise<string> {
  if (!isPathWithinWorkspace(args.path, workspaceFolders)) {
    return `Error: Access denied. Path "${args.path}" is not within the workspace.`;
  }
  try {
    // @ts-ignore
    const res = await window.api.readFile(args.path);
    if (res.error) return `Error reading file: ${res.error}`;
    return res.data;
  } catch (e: any) {
    return `Error: ${e.message}`;
  }
}

async function executeWriteFile(args: { path: string; content: string }, workspaceFolders: string[]): Promise<string> {
  if (!isPathWithinWorkspace(args.path, workspaceFolders)) {
    return `Error: Access denied. Path "${args.path}" is not within the workspace.`;
  }
  try {
    // @ts-ignore
    await window.api.saveFile(args.path, args.content);
    return `Successfully wrote ${args.content.length} characters to ${args.path}`;
  } catch (e: any) {
    return `Error: ${e.message}`;
  }
}

async function executeListFiles(args: { path: string }, workspaceFolders: string[]): Promise<string> {
  if (!isPathWithinWorkspace(args.path, workspaceFolders)) {
    return `Error: Access denied. Path "${args.path}" is not within the workspace.`;
  }
  try {
    // @ts-ignore
    const res = await window.api.getFiles(args.path);
    if (res.error) return `Error listing files: ${res.error}`;
    const entries = res.data.map((f: any) => `${f.isDirectory ? '📁' : '📄'} ${f.name}`);
    return entries.join('\n') || '(empty directory)';
  } catch (e: any) {
    return `Error: ${e.message}`;
  }
}

async function executeRunCommand(
  args: { command: string; cwd?: string },
  config: AgentConfig,
  workspaceFolders: string[],
  requestApproval: (command: string, cwd: string) => Promise<boolean>
): Promise<string> {
  const cwd = args.cwd || workspaceFolders[0] || '.';

  if (!config.autoApproveCommands) {
    const approved = await requestApproval(args.command, cwd);
    if (!approved) {
      return 'Command rejected by user.';
    }
  }

  try {
    // @ts-ignore
    const res = await window.api.runCommand(args.command, cwd);
    const output = [res.data?.stdout, res.data?.stderr, res.stdout, res.stderr].filter(Boolean).join('\n').trim();
    
    if (res.error) {
      // If we have output even on failure, just return that (e.g., validation diffs)
      if (output) return output;
      return `Command failed: ${res.error}`;
    }
    return output || '(no output)';
  } catch (e: any) {
    return `Error: ${e.message}`;
  }
}

async function executeSearchCodebase(args: { query: string; path: string; isRegex?: boolean }, workspaceFolders: string[]): Promise<string> {
  if (!isPathWithinWorkspace(args.path, workspaceFolders)) {
    return `Error: Access denied. Path "${args.path}" is not within the workspace.`;
  }
  try {
    const escapedQuery = args.query.replace(/'/g, "'\\''");
    const regexFlag = args.isRegex ? '-E' : '-F';
    // Use standard grep
    const cmd = `grep ${regexFlag} -rn '${escapedQuery}' . | head -n 50`;
    
    // @ts-ignore
    const res = await window.api.runCommand(cmd, args.path);
    if (res.error) {
      if (res.error.includes('exit code: 1')) return 'No matches found.';
      return `Error searching: ${res.error}`;
    }
    const output = [res.data?.stdout, res.data?.stderr].filter(Boolean).join('\n');
    return output.trim() || 'No matches found.';
  } catch (e: any) {
    return `Error: ${e.message}`;
  }
}

async function executeSpawnSubagent(
  args: { prompt: string },
  config: AgentConfig,
  workspaceFolders: string[],
  onEvent: (event: AgentStepEvent) => void,
  requestApproval: (command: string, cwd: string) => Promise<boolean>,
  skillContext?: string
): Promise<string> {
  try {
    const finalMessages = await runAgentLoop(
      `[SUBAGENT DELEGATION]: ${args.prompt}`,
      [],
      config,
      workspaceFolders,
      // Suppress subagent's UI updates except approvals to avoid chat UI state collision
      (event: AgentStepEvent) => {
        if (event.type === 'approval_request' || event.type === 'error') {
          onEvent(event);
        }
      },
      requestApproval,
      undefined,
      undefined // DO NOT pass skillContext down to subagents to prevent infinite recursion
    );
    const lastAsst = finalMessages.slice().reverse().find(m => m.role === 'assistant' && m.content);
    return lastAsst ? lastAsst.content : "Subagent completed task but returned no textual output.";
  } catch (e: any) {
    return `Subagent crashed: ${e.message}`;
  }
}

// ─── Agent Loop ──────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Aynite, an industry-grade AI coding assistant. You are rigorous, precise, and systematic.

## Operation Rules
1. **Chain of Thought**: Before ANY tool call or major conclusion, you MUST output a <thought> block explaining your reasoning, the evidence you've gathered, and your next step.
2. **Industrial Standards**: 
   - When writing Python scripts, you MUST include a \`if __name__ == "__main__":\` block.
   - When writing SKILL.md files, ensure they start with clear \`---\` YAML frontmatter.
3. **Verification**: After writing a file or running a command, verify the result before telling the user you are finished.
4. **conciseness**: Be direct. Use absolute paths. Format code properly.

## Continuous Execution
NEVER stop generating without an explanation or a tool call. If tools return results, proceed to analyze them immediately.`;

export interface AgentConfig {
  url: string;
  model: string;
  contextWindow: number;
  autoApproveCommands?: boolean;
}

export async function runAgentLoop(
  userMessage: string,
  history: AgentMessage[],
  config: AgentConfig,
  workspaceFolders: string[],
  onEvent: (event: AgentStepEvent) => void,
  requestApproval: (command: string, cwd: string) => Promise<boolean>,
  abortSignal?: AbortSignal,
  skillContext?: string
): Promise<AgentMessage[]> {

  const messages: AgentMessage[] = [
    { 
      role: 'system', 
      content: SYSTEM_PROMPT + 
        `\n\n### WORKSPACE CONTEXT\nYou are working in the following local directories. ALWAYS use these as base paths for your operations:\n${workspaceFolders.map(f => `- ${f}`).join('\n')}` +
        (config.model.toLowerCase().includes('gemma') ? "\n\n### COMPACT MODEL ADVISORY\nYou are running in a compact model mode. Be extra careful with syntax. Double-check your tool arguments and ensure all scripts are executable and self-contained." : "") +
        (skillContext ? `\n\n### ACTIVE SKILLS\nYou have access to the following skills. Their instructions are provided below in XML tags. Follow them strictly. Do not attempt to read the skill files directly; use the provided context:\n\n${skillContext}` : "") 
    },
    ...history,
    { role: 'user', content: userMessage },
  ];

  const MAX_ITERATIONS = 30;
  let iterations = 0;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    if (abortSignal?.aborted) {
      onEvent({ type: 'error', content: 'Request aborted.' });
      break;
    }

    // Call Ollama — only include fields the API accepts
    const ollamaMessages = messages.map((m) => {
      const msg: any = {
        role: m.role,
        content: m.content,
      };
      if (m.role === 'assistant' && m.tool_calls) {
        msg.tool_calls = m.tool_calls;
      }
      if (m.role === 'tool') {
        msg.tool_call_id = m.tool_call_id;
        msg.name = m.name;
      }
      return msg;
    });

    let response: Response;
    try {
      if (import.meta.env.DEV) {
        console.log('Sending request to Ollama:', {
          model: config.model,
          messages: ollamaMessages,
          tools: AGENT_TOOLS
        });
      }
      response = await fetch(`${config.url}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.model,
          messages: ollamaMessages,
          tools: AGENT_TOOLS,
          stream: false, // Non-streaming for tool calls to simplify the loop
          options: { num_ctx: config.contextWindow },
        }),
        signal: abortSignal,
      });
    } catch (e: any) {
      if (e.name === 'AbortError') {
        onEvent({ type: 'error', content: 'Request aborted.' });
        break;
      }
      onEvent({ type: 'error', content: `Network error: ${e.message}` });
      break;
    }

    if (!response.ok) {
      let errorDetail = response.statusText;
      try {
        const errorBody = await response.text();
        errorDetail = errorBody || errorDetail;
      } catch {}
      onEvent({ type: 'error', content: `Ollama API error (${response.status}): ${errorDetail}` });
      break;
    }

    const data = await response.json();
    const assistantMessage = data.message;

    if (!assistantMessage) {
      onEvent({ type: 'error', content: 'No response from model.' });
      break;
    }

    // Check for tool calls
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      // Add the assistant message with tool calls to history
      messages.push({
        role: 'assistant',
        content: assistantMessage.content || '',
        tool_calls: assistantMessage.tool_calls,
      });

      // If assistant provided text before tool calls, emit it
      if (assistantMessage.content) {
        onEvent({ type: 'text_delta', content: assistantMessage.content });
      }

      // Execute each tool call
      for (const toolCall of assistantMessage.tool_calls) {
        const fnName = toolCall.function?.name;
        const fnArgs = toolCall.function?.arguments || {};
        // Use the ID provided by the model if it exists, otherwise generate one
        const callId = toolCall.id || `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        onEvent({
          type: 'tool_call',
          content: `Calling ${fnName}`,
          toolName: fnName,
          toolArgs: fnArgs,
          toolCallId: callId,
        });

        let result: string;

        switch (fnName) {
          case 'read_file':
            result = await executeReadFile(fnArgs, workspaceFolders);
            break;
          case 'write_file':
            result = await executeWriteFile(fnArgs, workspaceFolders);
            break;
          case 'list_files':
            result = await executeListFiles(fnArgs, workspaceFolders);
            break;
          case 'run_command':
            onEvent({
              type: 'approval_request',
              content: `Run command: ${fnArgs.command}`,
              toolName: 'run_command',
              toolArgs: fnArgs,
              approvalId: callId,
            });
            result = await executeRunCommand(fnArgs, config, workspaceFolders, requestApproval);
            break;
          case 'search_codebase':
            result = await executeSearchCodebase(fnArgs as any, workspaceFolders);
            break;
          case 'spawn_subagent':
            onEvent({
              type: 'tool_call',
              content: `Spawning background subagent...`,
              toolName: 'spawn_subagent',
            });
            result = await executeSpawnSubagent(fnArgs as any, config, workspaceFolders, onEvent, requestApproval, skillContext);
            break;
          default:
            result = `Unknown tool: ${fnName}`;
        }

        onEvent({
          type: 'tool_result',
          content: result.length > 500 ? result.slice(0, 500) + '…' : result,
          toolName: fnName,
          toolCallId: callId,
        });

        // Add tool result to message history
        messages.push({
          role: 'tool',
          content: result,
          tool_call_id: callId,
          name: fnName,
        });
      }

      // Continue the loop — model will process tool results
      continue;
    }

    // No tool calls — this is the final text response
    const finalText = assistantMessage.content || '';
    
    // Auto-fix for local models that silently halt after tool results
    if (!finalText.trim() && messages.length > 0 && (messages[messages.length - 1].role === 'tool' || messages[messages.length - 1].role === 'assistant')) {
      if (import.meta.env.DEV) {
        console.log('Model returned empty response or halted. Nudging...');
      }
      messages.push({ role: 'user', content: 'Please continue and complete the remaining steps of your plan.' });
      continue;
    }

    messages.push({ role: 'assistant', content: finalText });

    // Stream-like emission of final text
    onEvent({ type: 'text_done', content: finalText });
    break;
  }

  if (iterations >= MAX_ITERATIONS) {
    onEvent({ type: 'error', content: 'Agent exceeded maximum iterations.' });
  }

  return messages;
}
