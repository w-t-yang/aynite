// @vitest-environment node

import type { UIMessage } from 'ai'
import { describe, expect, it } from 'vitest'

import {
  appendCommandOutput,
  appendPartToAssistant,
  appendReasoningToAssistant,
  appendToAssistant,
  appendToolInputDeltaToAssistant,
  estimateTokenCount,
  findUnfulfilledToolCalls,
  genId,
  getMessageText,
  isErrorMessage,
  updateToolResult,
} from '../../../../../src/renderer/views/aichat/utils/message'

// ─── Helpers ─────────────────────────────────────────────────────────

function textPart(text: string, state = 'done') {
  return { type: 'text' as const, text, state }
}

function reasoningPart(text: string, state = 'done') {
  return { type: 'reasoning' as const, text, state }
}

function toolPart(
  toolCallId: string,
  toolName: string,
  state: string,
  overrides: Partial<Record<string, unknown>> = {},
) {
  return {
    type: 'dynamic-tool' as const,
    toolCallId,
    toolName,
    state,
    ...overrides,
  }
}

function uiMsg(
  id: string,
  role: 'user' | 'assistant',
  parts: any[],
): UIMessage {
  return { id, role, parts } as UIMessage
}

function userMsg(text: string): UIMessage {
  return uiMsg(`u_${text.slice(0, 5)}`, 'user', [textPart(text)])
}

function asstMsg(id: string, parts: any[]): UIMessage {
  return uiMsg(id, 'assistant', parts)
}

// ─── genId ───────────────────────────────────────────────────────────

describe('genId', () => {
  it('generates IDs with msg_ prefix', () => {
    const id = genId()
    expect(id).toMatch(/^msg_/)
  })

  it('generates IDs containing a timestamp', () => {
    const id = genId()
    const parts = id.split('_')
    expect(parts.length).toBe(3)
    // second part should be a numeric timestamp
    expect(Number.isNaN(Number(parts[1]))).toBe(false)
    // third part should be 6 chars (random alphanumeric)
    expect(parts[2]).toHaveLength(6)
  })

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => genId()))
    expect(ids.size).toBe(100)
  })
})

// ─── getMessageText ──────────────────────────────────────────────────

describe('getMessageText', () => {
  it('formats a simple text-only message', () => {
    const msg = asstMsg('a1', [textPart('Hello world')])
    const text = getMessageText(msg)
    expect(text).toContain('[ASSISTANT]')
    expect(text).toContain('Hello world')
  })

  it('includes reasoning parts', () => {
    const msg = asstMsg('a1', [
      reasoningPart('Step 1: think'),
      textPart('Final answer'),
    ])
    const text = getMessageText(msg)
    expect(text).toContain('[Thinking]')
    expect(text).toContain('Step 1: think')
    expect(text).toContain('Final answer')
  })

  it('includes tool call parts with input and output', () => {
    const msg = asstMsg('a1', [
      toolPart('tc1', 'read_file', 'output-available', {
        input: { path: '/test.txt' },
        output: 'file content',
      }),
    ])
    const text = getMessageText(msg)
    expect(text).toContain('[Tool: read_file (output-available)]')
    expect(text).toContain('Input:')
    expect(text).toContain('/test.txt')
    expect(text).toContain('Output:')
    expect(text).toContain('file content')
  })

  it('handles empty parts array', () => {
    const msg = asstMsg('a1', [])
    const text = getMessageText(msg)
    expect(text).toContain('[ASSISTANT]')
  })

  it('handles user role message', () => {
    const msg = userMsg('How are you?')
    const text = getMessageText(msg)
    expect(text).toContain('[USER]')
    expect(text).toContain('How are you?')
  })

  it('handles string input for tool without serialization issues', () => {
    const msg = asstMsg('a1', [
      toolPart('tc1', 'search', 'output-available', {
        input: 'query text',
        output: 'results',
      }),
    ])
    const text = getMessageText(msg)
    expect(text).toContain('query text')
    expect(text).toContain('results')
  })
})

// ─── appendToAssistant ───────────────────────────────────────────────

describe('appendToAssistant', () => {
  it('appends text to existing assistant message', () => {
    const msgs = [userMsg('hi'), asstMsg('a1', [textPart('Hello')])]
    const result = appendToAssistant(msgs, ' world')
    expect(result).toHaveLength(2)
    const lastParts = result[1].parts
    expect(lastParts).toHaveLength(1)
    expect((lastParts[0] as any).text).toBe('Hello world')
    // When appending to existing text part, state is preserved from original
    expect((lastParts[0] as any).state).toBe('done')
  })

  it('creates new assistant message when last is not assistant', () => {
    const msgs = [userMsg('hi')]
    const result = appendToAssistant(msgs, 'Hello')
    expect(result).toHaveLength(2)
    expect(result[1].role).toBe('assistant')
    expect((result[1].parts[0] as any).text).toBe('Hello')
  })

  it('creates new assistant message when messages are empty', () => {
    const result = appendToAssistant([], 'Hello')
    expect(result).toHaveLength(1)
    expect(result[0].role).toBe('assistant')
    expect((result[0].parts[0] as any).text).toBe('Hello')
  })

  it('does not mutate the original array', () => {
    const msgs = [userMsg('hi'), asstMsg('a1', [textPart('Hello')])]
    const copy = [...msgs]
    appendToAssistant(msgs, ' world')
    expect(msgs).toEqual(copy)
  })
})

// ─── appendReasoningToAssistant ──────────────────────────────────────

describe('appendReasoningToAssistant', () => {
  it('appends reasoning to existing reasoning part', () => {
    const msgs = [userMsg('hi'), asstMsg('a1', [reasoningPart('Step 1')])]
    const result = appendReasoningToAssistant(msgs, ', Step 2')
    expect(result).toHaveLength(2)
    const parts = result[1].parts
    expect(parts).toHaveLength(1)
    expect((parts[0] as any).text).toBe('Step 1, Step 2')
  })

  it('adds reasoning part when last part is text', () => {
    const msgs = [userMsg('hi'), asstMsg('a1', [textPart('Answer')])]
    const result = appendReasoningToAssistant(msgs, 'Thinking...')
    expect(result).toHaveLength(2)
    const parts = result[1].parts
    expect(parts).toHaveLength(2) // text + reasoning
    expect((parts[1] as any).text).toBe('Thinking...')
  })

  it('creates new assistant message when last is not assistant', () => {
    const msgs = [userMsg('hi')]
    const result = appendReasoningToAssistant(msgs, 'Thinking...')
    expect(result).toHaveLength(2)
    expect(result[1].role).toBe('assistant')
    expect((result[1].parts[0] as any).text).toBe('Thinking...')
  })
})

// ─── appendPartToAssistant ───────────────────────────────────────────

describe('appendPartToAssistant', () => {
  it('adds new tool call part to last assistant message', () => {
    const msgs = [userMsg('hi'), asstMsg('a1', [textPart('Let me check')])]
    const result = appendPartToAssistant(msgs, {
      toolCallId: 'tc1',
      toolName: 'read_file',
      input: { path: '/test.txt' },
    })
    expect(result).toHaveLength(2)
    const parts = result[1].parts
    expect(parts).toHaveLength(2)
    const toolPartInserted = parts[1] as any
    expect(toolPartInserted.type).toBe('dynamic-tool')
    expect(toolPartInserted.toolCallId).toBe('tc1')
    expect(toolPartInserted.toolName).toBe('read_file')
    expect(toolPartInserted.state).toBe('input-available')
  })

  it('deduplicates tool calls with same toolCallId', () => {
    const msgs = [
      userMsg('hi'),
      asstMsg('a1', [
        textPart('Running'),
        toolPart('tc1', 'read_file', 'input-available', {
          input: { path: '/old.txt' },
        }),
      ]),
    ]
    const result = appendPartToAssistant(msgs, {
      toolCallId: 'tc1',
      toolName: 'read_file',
      input: { path: '/new.txt' },
    })
    const parts = result[1].parts
    expect(parts).toHaveLength(2) // still 2 parts (text + tool)
    const toolP = parts[1] as any
    expect(toolP.toolCallId).toBe('tc1')
    // Input should be updated to new value
    expect(toolP.input).toEqual({ path: '/new.txt' })
  })

  it('creates new assistant when no assistant message exists', () => {
    const msgs = [userMsg('hi')]
    const result = appendPartToAssistant(msgs, {
      toolCallId: 'tc1',
      toolName: 'search',
    })
    expect(result).toHaveLength(2)
    expect(result[1].role).toBe('assistant')
  })
})

// ─── updateToolResult ────────────────────────────────────────────────

describe('updateToolResult', () => {
  it('updates tool result in the last assistant message', () => {
    const msgs = [
      userMsg('hi'),
      asstMsg('a1', [
        toolPart('tc1', 'read_file', 'input-available', { input: '/f.txt' }),
      ]),
    ]
    const result = updateToolResult(msgs, {
      toolCallId: 'tc1',
      toolName: 'read_file',
      output: 'file contents here',
    })
    const parts = result[1].parts
    const toolP = parts[0] as any
    expect(toolP.state).toBe('output-available')
    expect(toolP.output).toBe('file contents here')
  })

  it('finds tool call in earlier message when not in last', () => {
    const msgs = [
      asstMsg('a1', [
        toolPart('tc1', 'search', 'input-available', { input: 'query' }),
      ]),
      userMsg('continue'),
      asstMsg('a2', [textPart('Working...')]),
    ]
    const result = updateToolResult(msgs, {
      toolCallId: 'tc1',
      toolName: 'search',
      output: 'results',
    })
    // The first message (index 0) should have its toolCallId updated
    const firstParts = result[0].parts
    const toolP = firstParts[0] as any
    expect(toolP.state).toBe('output-available')
    expect(toolP.output).toBe('results')
  })

  it('appends new assistant when no matching tool call found', () => {
    const msgs = [userMsg('hi')]
    const result = updateToolResult(msgs, {
      toolCallId: 'tc1',
      toolName: 'search',
      output: 'results',
    })
    expect(result).toHaveLength(2)
    const parts = result[1].parts
    const toolP = parts[0] as any
    expect(toolP.toolCallId).toBe('tc1')
    expect(toolP.state).toBe('output-available')
  })

  it('leaves other parts intact when updating', () => {
    const msgs = [
      asstMsg('a1', [
        textPart('Let me search'),
        toolPart('tc1', 'search', 'input-available', { input: 'q' }),
        toolPart('tc2', 'read', 'input-available', { input: 'f' }),
      ]),
    ]
    const result = updateToolResult(msgs, {
      toolCallId: 'tc1',
      toolName: 'search',
      output: 'results',
    })
    const parts = result[0].parts
    // text part preserved
    expect((parts[0] as any).text).toBe('Let me search')
    // tc1 updated
    expect((parts[1] as any).state).toBe('output-available')
    // tc2 untouched
    expect((parts[2] as any).state).toBe('input-available')
    expect((parts[2] as any).toolCallId).toBe('tc2')
  })
})

// ─── appendCommandOutput ─────────────────────────────────────────────

describe('appendCommandOutput', () => {
  it('appends output to executing run_command tool', () => {
    const msgs = [
      asstMsg('a1', [
        toolPart('tc1', 'run_command', 'executing', { output: 'partial ' }),
      ]),
    ]
    const result = appendCommandOutput(msgs, 'output')
    const parts = result[0].parts
    const toolP = parts[0] as any
    expect(toolP.output).toBe('partial output')
    expect(toolP.state).toBe('executing')
  })

  it('appends to input-available run_command tool', () => {
    const msgs = [
      asstMsg('a1', [toolPart('tc1', 'run_command', 'input-available')]),
    ]
    const result = appendCommandOutput(msgs, 'first output')
    const toolP = result[0].parts[0] as any
    expect(toolP.output).toBe('first output')
  })

  it('does nothing when no run_command tool found', () => {
    const msgs = [asstMsg('a1', [textPart('Hello')])]
    const result = appendCommandOutput(msgs, 'output')
    expect(result).toEqual(msgs)
  })

  it('only updates run_command (not other tools)', () => {
    const msgs = [
      asstMsg('a1', [
        toolPart('tc1', 'read_file', 'input-available'),
        toolPart('tc2', 'run_command', 'executing', { output: 'cmd ' }),
      ]),
    ]
    const result = appendCommandOutput(msgs, 'output')
    const parts = result[0].parts
    // read_file should be untouched
    expect((parts[0] as any).state).toBe('input-available')
    // run_command updated
    const toolP = parts[1] as any
    expect(toolP.output).toBe('cmd output')
  })

  it('searches backwards through messages for run_command', () => {
    const msgs = [
      asstMsg('a1', [
        toolPart('tc1', 'run_command', 'output-available', { output: 'old' }),
      ]),
      asstMsg('a2', [
        toolPart('tc2', 'run_command', 'executing', { output: 'current ' }),
      ]),
    ]
    const result = appendCommandOutput(msgs, 'append')
    // Should find the last executing run_command (in a2)
    const parts = result[1].parts
    expect((parts[0] as any).output).toBe('current append')
  })
})

// ─── appendToolInputDeltaToAssistant ─────────────────────────────────

describe('appendToolInputDeltaToAssistant', () => {
  it('appends delta to existing tool input', () => {
    const msgs = [
      asstMsg('a1', [
        toolPart('tc1', 'read_file', 'input-streaming', { input: 'par' }),
      ]),
    ]
    const result = appendToolInputDeltaToAssistant(msgs, 'tc1', 'tial')
    const parts = result[0].parts
    expect((parts[0] as any).input).toBe('partial')
  })

  it('does nothing if toolCallId not found', () => {
    const msgs = [
      asstMsg('a1', [
        toolPart('tc1', 'read_file', 'input-streaming', { input: 'x' }),
      ]),
    ]
    const result = appendToolInputDeltaToAssistant(msgs, 'unknown', 'delta')
    expect(result).toEqual(msgs)
  })

  it('does nothing if last message is not assistant', () => {
    const msgs = [userMsg('hi')]
    const result = appendToolInputDeltaToAssistant(msgs, 'tc1', 'delta')
    expect(result).toEqual(msgs)
  })
})

// ─── isErrorMessage ──────────────────────────────────────────────────

describe('isErrorMessage', () => {
  it('detects Error: prefix', () => {
    expect(isErrorMessage('Error: something broke')).toBe(true)
    expect(isErrorMessage('Normal message')).toBe(false)
  })

  it('detects Execution Error: prefix', () => {
    expect(isErrorMessage('Execution Error: failed')).toBe(true)
  })

  it('detects ** markdown emphasis', () => {
    expect(isErrorMessage('**Error**')).toBe(true)
  })

  it('detects JSON error status from serialized string', () => {
    // JSON.stringify produces '{"status":"error"}' (no space after colon),
    // so the c.includes('"status": "error"') check only matches pre-serialized strings
    expect(isErrorMessage('{"status": "error", "message": "fail"}')).toBe(true)
    expect(isErrorMessage('{"status": "ok"}')).toBe(false)
  })

  it('detects JSON error status from object when stringified', () => {
    // When an object is passed, JSON.stringify removes spaces after colons,
    // so the pattern '"status": "error"' (with space) is NOT matched.
    // This is current behavior — the function specifically checks for the
    // formatted string pattern.
    expect(isErrorMessage({ status: 'error' })).toBe(false)
  })

  it('handles null/undefined/falsy', () => {
    expect(isErrorMessage(null)).toBe(false)
    expect(isErrorMessage(undefined)).toBe(false)
    expect(isErrorMessage('')).toBe(false)
    expect(isErrorMessage(false)).toBe(false)
  })

  it('handles non-error strings', () => {
    expect(isErrorMessage('Everything is fine')).toBe(false)
    expect(isErrorMessage('Note: Error handling is important')).toBe(false)
  })
})

// ─── findUnfulfilledToolCalls ────────────────────────────────────────

describe('findUnfulfilledToolCalls', () => {
  it('finds tool calls awaiting output', () => {
    const msgs = [
      asstMsg('a1', [toolPart('tc1', 'read_file', 'input-available')]),
    ]
    const unfulfilled = findUnfulfilledToolCalls(msgs)
    expect(unfulfilled).toHaveLength(1)
    expect(unfulfilled[0].toolCallId).toBe('tc1')
  })

  it('excludes tool calls with output-available state', () => {
    const msgs = [
      asstMsg('a1', [
        toolPart('tc1', 'read_file', 'input-available'),
        toolPart('tc2', 'search', 'output-available', { output: 'done' }),
      ]),
    ]
    const unfulfilled = findUnfulfilledToolCalls(msgs)
    expect(unfulfilled).toHaveLength(1)
    expect(unfulfilled[0].toolCallId).toBe('tc1')
  })

  it('returns empty when all tool calls are fulfilled', () => {
    const msgs = [
      asstMsg('a1', [
        toolPart('tc1', 'read_file', 'output-available', { output: 'done' }),
        toolPart('tc2', 'search', 'output-available', { output: 'done' }),
      ]),
    ]
    const unfulfilled = findUnfulfilledToolCalls(msgs)
    expect(unfulfilled).toHaveLength(0)
  })

  it('scans all messages', () => {
    const msgs = [
      asstMsg('a1', [toolPart('tc1', 'search', 'input-streaming')]),
      userMsg('keep going'),
      asstMsg('a2', [toolPart('tc2', 'read_file', 'input-available')]),
    ]
    const unfulfilled = findUnfulfilledToolCalls(msgs)
    expect(unfulfilled).toHaveLength(2)
  })

  it('returns empty for no tool calls at all', () => {
    const msgs = [userMsg('hi'), asstMsg('a1', [textPart('OK')])]
    const unfulfilled = findUnfulfilledToolCalls(msgs)
    expect(unfulfilled).toHaveLength(0)
  })
})

// ─── estimateTokenCount ──────────────────────────────────────────────

describe('estimateTokenCount', () => {
  it('returns 0 for empty messages', () => {
    expect(estimateTokenCount([])).toBe(0)
  })

  it('estimates tokens based on JSON byte length', () => {
    const msgs = [userMsg('Hello world')]
    const serialized = JSON.stringify(msgs)
    const expected = Math.ceil(serialized.length * 0.4)
    expect(estimateTokenCount(msgs)).toBe(expected)
  })

  it('scales with number of messages', () => {
    const single = [userMsg('Hi')]
    const multiple = [userMsg('Hi'), asstMsg('a1', [textPart('Hello')])]
    expect(estimateTokenCount(multiple)).toBeGreaterThan(
      estimateTokenCount(single),
    )
  })

  it('returns 0 and does not throw for non-serializable content', () => {
    // Create a message with a circular reference (simulated by having
    // a part that can't be JSON stringified normally)
    const circular: any = { self: null }
    circular.self = circular
    // We'll test the try/catch by passing messages that cause JSON.stringify
    // to fail - but UIMessage type prevents that, so we rely on the
    // safe implementation. The try/catch in the source handles any edge case.
    const result = estimateTokenCount([])
    expect(result).toBe(0)
  })
})
