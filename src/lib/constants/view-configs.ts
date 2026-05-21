/**
 * Default view configuration definitions.
 *
 * Each view config is stored at ~/.aynite/config/views/[view]/config.json
 * during app initialization (see initViewConfigs in logic.ts).
 *
 * Views that expect data files (canvas, charts, diagrams, etc.) include
 * an `expected_file_type` field with a proper JSON Schema (Draft-07)
 * that can be used for runtime validation.
 */

import type { ViewConfig } from '../types/ai'

export const DEFAULT_VIEW_CONFIGS: Record<string, ViewConfig> = {
  // ─── Data-driven views (with expected_file_type) ────────────────────────

  canvas: {
    name: 'Canvas',
    description:
      'Excalidraw-based canvas for sketching diagrams and wireframes',
    author: 'Aynite',
    version: '1.0.0',
    expected_file_type: {
      ext: 'json',
      schema: {
        type: 'object',
        required: ['elements', 'appState'],
        properties: {
          type: { type: 'string' },
          version: { type: 'number' },
          elements: {
            type: 'array',
            items: { type: 'object' },
          },
          appState: { type: 'object' },
        },
      },
    },
    key_bindings: {},
  },

  datachart: {
    name: 'Data Chart',
    description:
      'Multi-type chart view supporting bar, line, area, pie, and radar charts',
    author: 'Aynite',
    version: '1.0.0',
    expected_file_type: {
      ext: 'json',
      schema: {
        type: 'object',
        required: ['keys', 'data'],
        properties: {
          title: { type: 'string' },
          keys: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
          },
          data: {
            type: 'array',
            items: { type: 'object' },
            minItems: 1,
          },
        },
      },
    },
    key_bindings: {},
  },

  diagram: {
    name: 'Diagram',
    description:
      'Mermaid-based diagram renderer supporting flowcharts, sequence diagrams, and more',
    author: 'Aynite',
    version: '1.0.0',
    expected_file_type: {
      ext: 'json',
      schema: {
        type: 'object',
        required: ['definition'],
        properties: {
          title: { type: 'string' },
          type: { type: 'string' },
          definition: { type: 'string' },
        },
      },
    },
    key_bindings: {},
  },

  flow: {
    name: 'Flow Editor',
    description: 'Interactive node-based flow chart editor using React Flow',
    author: 'Aynite',
    version: '1.0.0',
    expected_file_type: {
      ext: 'json',
      schema: {
        type: 'object',
        required: ['nodes', 'edges'],
        properties: {
          nodes: {
            type: 'array',
            items: {
              type: 'object',
              required: ['position', 'data'],
              properties: {
                id: { type: 'string' },
                position: {
                  type: 'object',
                  required: ['x', 'y'],
                  properties: {
                    x: { type: 'number' },
                    y: { type: 'number' },
                  },
                },
                data: {
                  type: 'object',
                  required: ['label'],
                },
                type: { type: 'string' },
              },
            },
            minItems: 1,
          },
          edges: {
            type: 'array',
            items: {
              type: 'object',
              required: ['source', 'target'],
              properties: {
                id: { type: 'string' },
                source: { type: 'string' },
                target: { type: 'string' },
                label: { type: 'string' },
              },
            },
          },
          viewport: { type: 'object' },
        },
      },
    },
    key_bindings: {},
  },

  graph: {
    name: 'Graph Explorer',
    description: 'Force-directed graph visualization for network data',
    author: 'Aynite',
    version: '1.0.0',
    expected_file_type: {
      ext: 'json',
      schema: {
        type: 'object',
        required: ['nodes', 'links'],
        properties: {
          nodes: {
            type: 'array',
            items: {
              type: 'object',
              required: ['id', 'label'],
              properties: {
                id: { type: 'string' },
                label: { type: 'string' },
                group: { type: 'number' },
                val: { type: 'number' },
              },
            },
            minItems: 1,
          },
          links: {
            type: 'array',
            items: {
              type: 'object',
              required: ['source', 'target'],
              properties: {
                source: { type: 'string' },
                target: { type: 'string' },
                value: { type: 'number' },
              },
            },
          },
        },
      },
    },
    key_bindings: {},
  },

  mindmap: {
    name: 'MindMap',
    description:
      'Interactive mind map visualization with collapsible tree branches',
    author: 'Aynite',
    version: '1.0.0',
    expected_file_type: {
      ext: 'json',
      schema: {
        type: 'object',
        required: ['root'],
        properties: {
          root: {
            type: 'object',
            required: ['id', 'label'],
            properties: {
              id: { type: 'string' },
              label: { type: 'string' },
              children: {
                type: 'array',
                items: { type: 'object' },
              },
            },
          },
        },
      },
    },
    key_bindings: {},
  },

  stockchart: {
    name: 'Stock Chart',
    description:
      'Candlestick chart with technical indicators and multi-timeframe support',
    author: 'Aynite',
    version: '1.0.0',
    expected_file_type: {
      ext: 'json',
      schema: {
        anyOf: [
          {
            required: ['symbol', 'data'],
            properties: {
              symbol: { type: 'string' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['open', 'high', 'low', 'close', 'volume'],
                  properties: {
                    time: { type: 'string' },
                    date: { type: 'string' },
                    open: { type: 'number' },
                    high: { type: 'number' },
                    low: { type: 'number' },
                    close: { type: 'number' },
                    volume: { type: 'number' },
                  },
                },
              },
            },
          },
          {
            required: ['metadata', 'history'],
            properties: {
              metadata: {
                type: 'object',
                properties: {
                  symbol: { type: 'string' },
                },
              },
              history: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['open', 'high', 'low', 'close', 'volume'],
                },
              },
            },
          },
        ],
      },
    },
    key_bindings: {},
  },

  'theme-studio': {
    name: 'Theme Studio',
    description: 'Live color theme editor with real-time preview',
    author: 'Aynite',
    version: '1.0.0',
    expected_file_type: {
      ext: 'json',
      schema: {
        type: 'object',
        required: ['id', 'colors'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          type: { type: 'string', enum: ['light', 'dark'] },
          colors: {
            type: 'object',
            patternProperties: {
              '^[a-zA-Z0-9_-]+$': { type: 'string' },
            },
          },
        },
      },
    },
    key_bindings: {},
  },

  // ─── Non-data views (no expected_file_type) ─────────────────────────────

  aichat: {
    name: 'AI Chat',
    description: 'AI assistant chat interface with session management',
    author: 'Aynite',
    version: '1.0.0',
    key_bindings: {},
  },

  'ai-browser': {
    name: 'AI Browser',
    description: 'Hybrid view that switches between AI chat and file browser',
    author: 'Aynite',
    version: '1.0.0',
    key_bindings: {},
  },

  'file-browser': {
    name: 'File Browser',
    description: 'Multi-tab file editor with syntax highlighting',
    author: 'Aynite',
    version: '1.0.0',
    key_bindings: {},
  },

  'workspace-view': {
    name: 'Workspace View',
    description:
      'Workspace overview with folders, artifacts, sessions, and git status',
    author: 'Aynite',
    version: '1.0.0',
    key_bindings: {},
  },

  settings: {
    name: 'Settings',
    description: 'Application settings and configuration panel',
    author: 'Aynite',
    version: '1.0.0',
    key_bindings: {},
  },

  rss: {
    name: 'RSS Reader',
    description: 'RSS/Atom feed reader with bookmarking and group management',
    author: 'Aynite',
    version: '1.0.0',
    key_bindings: {},
  },

  spotify: {
    name: 'Spotify Explorer',
    description: 'Spotify music library browser with playback controls',
    author: 'Aynite',
    version: '1.0.0',
    key_bindings: {},
  },

  treeview: {
    name: 'File Tree',
    description: 'Project file tree explorer with git status indicators',
    author: 'Aynite',
    version: '1.0.0',
    key_bindings: {},
  },
}
