import type { ChatMessage } from '../../../../lib/types/chat'

export const MOCK_SESSION: ChatMessage[] = [
  {
    id: 'm1',
    role: 'system',
    content:
      'You are Aynite AI, a powerful coding assistant. You have access to the local filesystem and terminal.',
    createdAt: Date.now() - 100000,
  },
  {
    id: 'm2',
    role: 'user',
    content: 'Can you show me how you handle different message types?',
    createdAt: Date.now() - 90000,
  },
  {
    id: 'm3',
    role: 'assistant',
    content: [
      {
        type: 'reasoning',
        text: 'The user wants to see a demonstration of all supported message parts. I should provide a text response, show a thinking process, and simulate a tool call followed by its result.',
      },
      {
        type: 'text',
        text: "Of course! I can handle plain text, complex reasoning blocks, and tool interactions. For example, here's me checking the current directory:",
      },
      {
        type: 'tool-call',
        toolCallId: 'call_123',
        toolName: 'list_dir',
        input: { path: './src' },
      },
    ],
    createdAt: Date.now() - 80000,
  },
  {
    id: 'm4',
    role: 'tool',
    content: [
      {
        type: 'tool-result',
        toolCallId: 'call_123',
        toolName: 'list_dir',
        output: [
          { name: 'main', isDir: true },
          { name: 'renderer', isDir: true },
          { name: 'lib', isDir: true },
          { name: 'package.json', isDir: false },
        ],
      },
    ],
    createdAt: Date.now() - 70000,
  },
  {
    id: 'm5',
    role: 'assistant',
    content:
      'I found several directories. Now, let me try a command that might fail to show you an error state:',
    createdAt: Date.now() - 60000,
  },
  {
    id: 'm6',
    role: 'assistant',
    content: [
      {
        type: 'tool-call',
        toolCallId: 'call_456',
        toolName: 'run_command',
        input: { command: 'cat non_existent_file.txt' },
      },
    ],
    createdAt: Date.now() - 50000,
  },
  {
    id: 'm7',
    role: 'tool',
    content: [
      {
        type: 'tool-result',
        toolCallId: 'call_456',
        toolName: 'run_command',
        output: 'Error: cat: non_existent_file.txt: No such file or directory',
      },
    ],
    createdAt: Date.now() - 40000,
  },
  {
    id: 'm8',
    role: 'assistant',
    content:
      'As you can see, errors are clearly highlighted. Is there anything else you would like to test?',
    createdAt: Date.now() - 30000,
  },
]
