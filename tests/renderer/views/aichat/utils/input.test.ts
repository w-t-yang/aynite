// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import {
  flattenWorkspaceFiles,
  serializeTiptapToText,
} from '../../../../../src/renderer/views/aichat/utils/input'

describe('serializeTiptapToText', () => {
  it('returns empty string for null/undefined', () => {
    expect(serializeTiptapToText(null)).toBe('')
    expect(serializeTiptapToText(undefined)).toBe('')
  })

  it('extracts text from a text node', () => {
    const json = { type: 'text', text: 'Hello world' }
    expect(serializeTiptapToText(json)).toBe('Hello world')
  })

  it('converts hardBreak to newline', () => {
    const json = { type: 'hardBreak' }
    expect(serializeTiptapToText(json)).toBe('\n')
  })

  it('converts mention node to @file[...](...) format', () => {
    const json = {
      type: 'mention',
      attrs: { id: '/path/to/file.ts', label: 'file.ts', isDirectory: false },
    }
    expect(serializeTiptapToText(json)).toBe('@file[file.ts](/path/to/file.ts)')
  })

  it('converts directory mention to @dir[...](...) format', () => {
    const json = {
      type: 'mention',
      attrs: { id: '/path/to/dir', label: 'dir', isDirectory: true },
    }
    expect(serializeTiptapToText(json)).toBe('@dir[dir](/path/to/dir)')
  })

  it('converts skill mention to /skill[...](...) format', () => {
    const json = {
      type: 'skillMention',
      attrs: { id: 'test-skill', label: 'Test Skill' },
    }
    expect(serializeTiptapToText(json)).toBe('/skill[Test Skill](test-skill)')
  })

  it('converts command mention to >cmd[...](...) format', () => {
    const json = {
      type: 'commandMention',
      attrs: { id: '/path/to/cmd', label: 'my-command' },
    }
    expect(serializeTiptapToText(json)).toBe('>cmd[my-command](/path/to/cmd)')
  })

  it('renders paragraph with newline suffix', () => {
    const json = {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Hello world' }],
    }
    expect(serializeTiptapToText(json)).toBe('Hello world\n')
  })

  it('renders doc without trailing newline', () => {
    const json = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'First paragraph' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Second paragraph' }],
        },
      ],
    }
    const result = serializeTiptapToText(json)
    expect(result).toBe('First paragraph\nSecond paragraph')
    expect(result.endsWith('\n')).toBe(false)
  })

  it('handles nested content inside unknown wrapper nodes', () => {
    const json = {
      type: 'unknownWrapper',
      content: [
        { type: 'text', text: 'nested ' },
        { type: 'text', text: 'content' },
      ],
    }
    expect(serializeTiptapToText(json)).toBe('nested content')
  })

  it('handles mixed content in a paragraph: text + mention', () => {
    const json = {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Check this file: ' },
        {
          type: 'mention',
          attrs: {
            id: '/path/to/file.ts',
            label: 'file.ts',
            isDirectory: false,
          },
        },
      ],
    }
    expect(serializeTiptapToText(json)).toBe(
      'Check this file: @file[file.ts](/path/to/file.ts)\n',
    )
  })

  it('handles doc with no content array', () => {
    const json = { type: 'doc' }
    expect(serializeTiptapToText(json)).toBe('')
  })

  it('handles paragraph with no content', () => {
    const json = { type: 'paragraph', content: [] }
    expect(serializeTiptapToText(json)).toBe('\n')
  })

  it('handles text with marks property (ignores marks)', () => {
    const json = {
      type: 'text',
      text: 'bold text',
      marks: [{ type: 'bold' }],
    }
    expect(serializeTiptapToText(json)).toBe('bold text')
  })

  it('handles deeply nested doc with paragraphs, mentions, and text', () => {
    const json = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Analyze ' },
            {
              type: 'mention',
              attrs: {
                id: '/src/index.ts',
                label: 'index.ts',
                isDirectory: false,
              },
            },
          ],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Using skill: ' },
            {
              type: 'skillMention',
              attrs: { id: 'code-review', label: 'Code Review' },
            },
          ],
        },
      ],
    }
    const result = serializeTiptapToText(json)
    expect(result).toContain('Analyze')
    expect(result).toContain('@file[index.ts](/src/index.ts)')
    expect(result).toContain('/skill[Code Review](code-review)')
  })
})

// ─── flattenWorkspaceFiles ────────────────────────────────────────────

describe('flattenWorkspaceFiles', () => {
  it('returns root folder when folder has no files', async () => {
    const getFiles = vi.fn().mockResolvedValue([])
    const items = await flattenWorkspaceFiles(['/workspace'], getFiles)
    // Root folder should always be included
    expect(items.length).toBeGreaterThanOrEqual(1)
    expect(items[0]).toMatchObject({
      id: '/workspace',
      label: 'workspace',
      isDirectory: true,
    })
  })

  it('includes root folder and its files', async () => {
    const getFiles = vi.fn().mockImplementation((dir: string) => {
      if (dir === '/workspace') {
        return Promise.resolve([
          { path: '/workspace/file.ts', name: 'file.ts', isDirectory: false },
          { path: '/workspace/src', name: 'src', isDirectory: true },
        ])
      }
      return Promise.resolve([])
    })
    const items = await flattenWorkspaceFiles(['/workspace'], getFiles)
    expect(items.length).toBe(3) // root + file.ts + src
    expect(items.some((i) => i.name === 'file.ts')).toBe(true)
    expect(items.some((i) => i.name === 'src')).toBe(true)
  })

  it('recursively walks nested directories', async () => {
    const getFiles = vi.fn().mockImplementation((dir: string) => {
      if (dir === '/workspace') {
        return Promise.resolve([
          { path: '/workspace/src', name: 'src', isDirectory: true },
        ])
      }
      if (dir === '/workspace/src') {
        return Promise.resolve([
          {
            path: '/workspace/src/index.ts',
            name: 'index.ts',
            isDirectory: false,
          },
        ])
      }
      return Promise.resolve([])
    })
    const items = await flattenWorkspaceFiles(['/workspace'], getFiles)
    expect(items.some((i) => i.name === 'index.ts')).toBe(true)
    expect(items.some((i) => i.name === 'src')).toBe(true)
  })

  it('respects maxDepth limit', async () => {
    let depth = 0
    const getFiles = vi.fn().mockImplementation(() => {
      depth++
      if (depth <= 3) {
        return Promise.resolve([
          {
            path: `/workspace/dir${depth}`,
            name: `dir${depth}`,
            isDirectory: true,
          },
        ])
      }
      return Promise.resolve([])
    })
    const items = await flattenWorkspaceFiles(['/workspace'], getFiles, 2)
    // Root + dir1 (depth 1) + dir2 (depth 2) — dir3 should be beyond maxDepth
    expect(items.length).toBe(3) // root + dir1 + dir2
    expect(items.some((i) => i.name === 'dir1')).toBe(true)
    expect(items.some((i) => i.name === 'dir2')).toBe(true)
    expect(items.some((i) => i.name === 'dir3')).toBe(false)
  })

  it('handles errors during file listing gracefully', async () => {
    const getFiles = vi.fn().mockRejectedValue(new Error('Permission denied'))
    const items = await flattenWorkspaceFiles(['/workspace'], getFiles)
    // Error caught silently, at least root folder returned
    expect(items.length).toBeGreaterThanOrEqual(1)
    expect(items[0].id).toBe('/workspace')
  })

  it('handles multiple workspace folders', async () => {
    const getFiles = vi.fn().mockImplementation((dir: string) => {
      if (dir === '/workspace1') {
        return Promise.resolve([
          { path: '/workspace1/a.ts', name: 'a.ts', isDirectory: false },
        ])
      }
      if (dir === '/workspace2') {
        return Promise.resolve([
          { path: '/workspace2/b.ts', name: 'b.ts', isDirectory: false },
        ])
      }
      return Promise.resolve([])
    })
    const items = await flattenWorkspaceFiles(
      ['/workspace1', '/workspace2'],
      getFiles,
    )
    // 2 roots + 2 files
    expect(items.length).toBe(4)
    expect(items.some((i) => i.name === 'a.ts')).toBe(true)
    expect(items.some((i) => i.name === 'b.ts')).toBe(true)
  })

  it('assigns correct labels with root prefix', async () => {
    const getFiles = vi.fn().mockImplementation((dir: string) => {
      if (dir === '/root') {
        return Promise.resolve([
          {
            path: '/root/src/index.ts',
            name: 'index.ts',
            isDirectory: false,
          },
        ])
      }
      return Promise.resolve([])
    })
    const items = await flattenWorkspaceFiles(['/root'], getFiles)
    const file = items.find((i) => i.name === 'index.ts')
    expect(file).toBeDefined()
    expect(file?.label).toBe('root/src/index.ts')
  })
})
