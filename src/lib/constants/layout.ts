import type { LayoutConfig } from './types'

// ─── Aynite Playbook Layouts ──────────────────────────────────────────────

export const PLAYBOOK_LAYOUTS: LayoutConfig[] = [
  {
    id: 'pb-welcome',
    name: 'Welcome',
    layout: {
      id: 'split-pb-welcome',
      type: 'split',
      direction: 'horizontal',
      size: 100,
      children: [
        { id: 'tile-pb-tree', type: 'leaf', name: 'treeview', size: 20 },
        { id: 'tile-pb-browser', type: 'leaf', name: 'file-browser', size: 50 },
        { id: 'tile-pb-chat', type: 'leaf', name: 'aichat', size: 30 },
      ],
    },
  },
  {
    id: 'pb-whiteboard',
    name: 'Whiteboard',
    layout: {
      id: 'split-pb-whiteboard',
      type: 'split',
      direction: 'vertical',
      size: 100,
      children: [
        {
          id: 'tile-pb-canvas',
          type: 'leaf',
          name: 'dataview-canvas',
          size: 60,
        },
        {
          id: 'tile-pb-mindmap',
          type: 'leaf',
          name: 'dataview-mindmap',
          size: 40,
        },
      ],
    },
  },
  {
    id: 'pb-diagrams',
    name: 'Diagrams',
    layout: {
      id: 'split-pb-diagrams',
      type: 'split',
      direction: 'vertical',
      size: 100,
      children: [
        {
          id: 'split-pb-diagrams-top',
          type: 'split',
          direction: 'horizontal',
          size: 50,
          children: [
            {
              id: 'tile-pb-flow',
              type: 'leaf',
              name: 'dataview-flow',
              size: 50,
            },
            {
              id: 'tile-pb-diagram',
              type: 'leaf',
              name: 'dataview-diagram',
              size: 50,
            },
          ],
        },
        {
          id: 'split-pb-diagrams-bot',
          type: 'split',
          direction: 'horizontal',
          size: 50,
          children: [
            {
              id: 'tile-pb-datachart',
              type: 'leaf',
              name: 'dataview-chart',
              size: 50,
            },
            {
              id: 'tile-pb-graph',
              type: 'leaf',
              name: 'dataview-graph',
              size: 50,
            },
          ],
        },
      ],
    },
  },
]

// ─── Market Lens (Trader) Layouts ─────────────────────────────────────────

export const TRADER_LAYOUTS: LayoutConfig[] = [
  {
    id: 'trader-desk',
    name: 'Trading Desk',
    layout: {
      id: 'split-trader-desk',
      type: 'split',
      direction: 'horizontal',
      size: 100,
      children: [
        {
          id: 'tile-trader-stock',
          type: 'leaf',
          name: 'dataview-stock',
          size: 70,
        },
        { id: 'tile-trader-chat', type: 'leaf', name: 'aichat', size: 30 },
      ],
    },
  },
  {
    id: 'trader-portfolio',
    name: 'Portfolio',
    layout: {
      id: 'split-trader-portfolio',
      type: 'split',
      direction: 'vertical',
      size: 100,
      children: [
        {
          id: 'split-tp-row1',
          type: 'split',
          direction: 'horizontal',
          size: 50,
          children: [
            {
              id: 'tile-tp-s1',
              type: 'leaf',
              name: 'dataview-stock',
              size: 33.3,
            },
            {
              id: 'tile-tp-s2',
              type: 'leaf',
              name: 'dataview-stock',
              size: 33.3,
            },
            {
              id: 'tile-tp-s3',
              type: 'leaf',
              name: 'dataview-stock',
              size: 33.4,
            },
          ],
        },
        {
          id: 'split-tp-row2',
          type: 'split',
          direction: 'horizontal',
          size: 50,
          children: [
            {
              id: 'tile-tp-s4',
              type: 'leaf',
              name: 'dataview-stock',
              size: 33.3,
            },
            {
              id: 'tile-tp-s5',
              type: 'leaf',
              name: 'dataview-stock',
              size: 33.3,
            },
            {
              id: 'tile-tp-s6',
              type: 'leaf',
              name: 'dataview-stock',
              size: 33.4,
            },
          ],
        },
      ],
    },
  },
  {
    id: 'trader-research',
    name: 'Research',
    layout: {
      id: 'split-trader-research',
      type: 'split',
      direction: 'horizontal',
      size: 100,
      children: [
        {
          id: 'tile-trader-res-tree',
          type: 'leaf',
          name: 'treeview',
          size: 25,
        },
        {
          id: 'tile-trader-res-browser',
          type: 'leaf',
          name: 'file-browser',
          size: 50,
        },
        { id: 'tile-trader-res-chat', type: 'leaf', name: 'aichat', size: 25 },
      ],
    },
  },
]

// ─── The Quill (Writer) Layouts ───────────────────────────────────────────

export const WRITER_LAYOUTS: LayoutConfig[] = [
  {
    id: 'quill-desk',
    name: 'Writing Desk',
    layout: {
      id: 'split-quill-desk',
      type: 'split',
      direction: 'horizontal',
      size: 100,
      children: [
        { id: 'tile-quill-tree', type: 'leaf', name: 'treeview', size: 20 },
        {
          id: 'tile-quill-browser',
          type: 'leaf',
          name: 'file-browser',
          size: 50,
        },
        { id: 'tile-quill-chat', type: 'leaf', name: 'aichat', size: 30 },
      ],
    },
  },
  {
    id: 'quill-brainstorm',
    name: 'Brainstorm',
    layout: {
      id: 'split-quill-brainstorm',
      type: 'split',
      direction: 'horizontal',
      size: 100,
      children: [
        {
          id: 'split-quill-bs-left',
          type: 'split',
          direction: 'vertical',
          size: 60,
          children: [
            {
              id: 'tile-quill-mindmap',
              type: 'leaf',
              name: 'dataview-mindmap',
              size: 50,
            },
            {
              id: 'tile-quill-graph',
              type: 'leaf',
              name: 'dataview-graph',
              size: 50,
            },
          ],
        },
        { id: 'tile-quill-bs-chat', type: 'leaf', name: 'aichat', size: 40 },
      ],
    },
  },
  {
    id: 'quill-sketch',
    name: 'Sketch Pad',
    layout: {
      id: 'tile-quill-canvas',
      type: 'leaf',
      name: 'dataview-canvas',
      size: 100,
    },
  },
]
