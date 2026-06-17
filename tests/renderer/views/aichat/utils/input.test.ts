// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { serializeTiptapToText } from '../../../../../src/renderer/views/aichat/utils/input'

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
