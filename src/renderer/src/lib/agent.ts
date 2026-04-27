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
      description: 'Read the contents of a file at the given path. The path must be within the workspace.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute path to the file to read' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'write_file',
      description: 'Write content to a file at the given path. Creates the file if it does not exist. The path must be within the workspace.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute path to the file to write' },
          content: { type: 'string', description: 'Content to write to the file' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_files',
      description: 'List all files and directories in the given directory path. The path must be within the workspace.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute path to the directory to list' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'run_command',
      description: 'Run a shell command. This requires user approval before execution.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The shell command to execute' },
          cwd: { type: 'string', description: 'Working directory for the command (optional, defaults to first workspace folder)' },
        },
        required: ['command'],
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
  workspaceFolders: string[],
  requestApproval: (command: string, cwd: string) => Promise<boolean>
): Promise<string> {
  const cwd = args.cwd || workspaceFolders[0] || '.';

  const approved = await requestApproval(args.command, cwd);
  if (!approved) {
    return 'Command rejected by user.';
  }

  try {
    // @ts-ignore
    const res = await window.api.runCommand(args.command, cwd);
    if (res.error) {
      return `Command failed:\nstdout: ${res.stdout || ''}\nstderr: ${res.stderr || ''}\nerror: ${res.error}`;
    }
    const output = [res.data?.stdout, res.data?.stderr].filter(Boolean).join('\n');
    return output || '(no output)';
  } catch (e: any) {
    return `Error: ${e.message}`;
  }
}

// ─── Agent Loop ──────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Citron, an AI coding assistant embedded in a file explorer IDE. You can read files, write files, list directories, and run shell commands within the user's workspace.

Rules:
- Always explain what you plan to do before calling a tool.
- When reading or writing files, use absolute paths within the workspace.
- When running commands, explain what the command does.
- Be concise and helpful. Format code in markdown code blocks.`;

export interface AgentConfig {
  url: string;
  model: string;
  contextWindow: number;
}

export async function runAgentLoop(
  userMessage: string,
  history: AgentMessage[],
  config: AgentConfig,
  workspaceFolders: string[],
  onEvent: (event: AgentStepEvent) => void,
  requestApproval: (command: string, cwd: string) => Promise<boolean>,
  abortSignal?: AbortSignal
): Promise<AgentMessage[]> {

  const messages: AgentMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: userMessage },
  ];

  const MAX_ITERATIONS = 10;
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
            result = await executeRunCommand(fnArgs, workspaceFolders, requestApproval);
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
