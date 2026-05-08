import type { ChatMessage } from '../../types/chat'

export const MOCK_MESSAGES: ChatMessage[] = [
  {
    id: 'mock-sys-1',
    role: 'system',
    content:
      'You are Aynite, an AI coding assistant. You help users understand and modify their codebase.',
    createdAt: 1000,
  },
  {
    id: 'mock-user-1',
    role: 'user',
    content:
      'Hello! Can you help me understand how the tile layout system works?',
    createdAt: 2000,
  },
  {
    id: 'mock-assistant-1',
    role: 'assistant',
    content:
      'The tile layout system uses a recursive split-tree model. Each `SplitNode` divides space horizontally or vertically, and `LeafNode` holds a content pane. Let me search for the relevant code.',
    createdAt: 3000,
  },
  {
    id: 'mock-user-2',
    role: 'user',
    content: 'Search for the TileNode component implementation.',
    createdAt: 4000,
  },
  {
    id: 'mock-assistant-2',
    role: 'assistant',
    content: [
      {
        type: 'reasoning',
        text: 'The user wants to find TileNode component. I should grep for it in the src directory.',
      },
      {
        type: 'text',
        text: "I'll search for TileNode in your codebase.",
      },
      {
        type: 'tool-call',
        toolCallId: 'mock-tc-1',
        toolName: 'grep_search',
        args: { pattern: 'TileNode', folderPath: 'src' },
      },
    ],
    createdAt: 5000,
  },
  {
    id: 'mock-tool-1',
    role: 'tool',
    content: [
      {
        type: 'tool-result',
        toolCallId: 'mock-tc-1',
        toolName: 'grep_search',
        result:
          'src/renderer/src/layout/TileNode.tsx\nsrc/renderer/src/layout/Tile.tsx\nsrc/renderer/src/utils/tile.ts\nsrc/renderer/src/context/AppContext.tsx',
      },
    ],
    createdAt: 6000,
  },
  {
    id: 'mock-assistant-3',
    role: 'assistant',
    content: [
      {
        type: 'text',
        text: 'Found TileNode in these files:\n\n- `src/renderer/src/layout/TileNode.tsx` — main component\n- `src/renderer/src/utils/tile.ts` — layout operations\n\nWould you like me to read the source?',
      },
    ],
    createdAt: 7000,
  },
  {
    id: 'mock-user-3',
    role: 'user',
    content:
      'Yes, read the TileNode.tsx file and explain how it works with the split tree.',
    createdAt: 8000,
  },
  {
    id: 'mock-assistant-4',
    role: 'assistant',
    content: [
      {
        type: 'reasoning',
        text: 'The user wants to see TileNode.tsx. I need to read it first.',
      },
      {
        type: 'tool-call',
        toolCallId: 'mock-tc-2',
        toolName: 'read_file',
        args: { path: 'src/renderer/src/layout/TileNode.tsx' },
      },
    ],
    createdAt: 9000,
  },
  {
    id: 'mock-tool-2',
    role: 'tool',
    content: [
      {
        type: 'tool-result',
        toolCallId: 'mock-tc-2',
        toolName: 'read_file',
        result:
          'import { type TileNode as TileNodeType } from ...\n\nexport function TileNode({ node, ... }: Props) {\n  if (node.type === "split") {\n    return <SplitNode ... />\n  }\n  return <LeafNode ... />\n}',
      },
    ],
    createdAt: 10000,
  },
  {
    id: 'mock-assistant-5',
    role: 'assistant',
    content: [
      {
        type: 'text',
        text: 'Here is how `TileNode` works:\n\nIt checks the node type. If the node is a `split` node, it renders `SplitNode` which divides space between children. If it\'s a `leaf` node, it renders the content pane.\n\n```tsx\nif (node.type === "split") {\n  return <SplitNode direction={node.direction}>\n    {node.children.map(child => <TileNode node={child} />)}\n  </SplitNode>\n}\nreturn <LeafNode content={node.content} />\n```\n\nThe split tree is recursive — each split contains more splits or leaves.',
      },
    ],
    createdAt: 11000,
  },
]
