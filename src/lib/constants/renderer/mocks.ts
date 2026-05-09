import type { UIMessage } from 'ai'

export const MOCK_MESSAGES: UIMessage[] = [
  {
    id: 'm1',
    role: 'system',
    parts: [{ type: 'text', text: 'You are Aynite, a powerful AI assistant.' }],
  },
  {
    id: 'm2',
    role: 'user',
    parts: [
      {
        type: 'text',
        text: 'Hey! Show me all the types of messages you support.',
      },
    ],
  },
  {
    id: 'm3',
    role: 'assistant',
    parts: [
      {
        type: 'reasoning',
        text: 'The user wants to see a demonstration of all supported message parts. I should provide a text response, show a thinking process, and simulate a tool call followed by its result.',
      },
      {
        type: 'text',
        text: "Of course! I can handle plain text, complex reasoning blocks, and tool interactions. For example, here's me checking the current directory:",
      },
      {
        type: 'dynamic-tool',
        toolCallId: 'call_123',
        toolName: 'list_dir',
        state: 'input-available',
        input: { path: './src' },
      },
    ],
  },
  {
    id: 'm4',
    role: 'assistant',
    parts: [
      {
        type: 'dynamic-tool',
        toolCallId: 'call_123',
        toolName: 'list_dir',
        state: 'output-available',
        input: { path: './src' },
        output: [
          { name: 'main', isDir: true },
          { name: 'renderer', isDir: true },
          { name: 'lib', isDir: true },
          { name: 'package.json', isDir: false },
        ],
      },
    ],
  },
  {
    id: 'm5',
    role: 'assistant',
    parts: [
      {
        type: 'text',
        text: 'I found several directories. Now, let me try a command that might fail to show you an error state:',
      },
    ],
  },
  {
    id: 'm6',
    role: 'assistant',
    parts: [
      {
        type: 'dynamic-tool',
        toolCallId: 'call_err',
        toolName: 'run_command',
        state: 'output-error',
        input: { command: 'cat non_existent_file.txt' },
        errorText: 'Error: No such file or directory: non_existent_file.txt',
      },
    ],
  },
  {
    id: 'm7',
    role: 'assistant',
    parts: [
      {
        type: 'text',
        text: 'And finally, here is some markdown code blocks and formatting:\n\n```typescript\nconst message = "Hello from Aynite!";\nconsole.log(message);\n```\n\n- Bullet points\n- **Bold text**\n- *Italics*',
      },
    ],
  },
]
