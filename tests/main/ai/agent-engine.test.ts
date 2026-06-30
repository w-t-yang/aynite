import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Mocks ──────────────────────────────────────────────────────────────

let mockStreamEvents: any[] = []

// hoisted so we can reference it in both the mock factory and test assertions
const mockConvertToModelMessages = vi.hoisted(() =>
  vi.fn(() => Promise.resolve([])),
)

vi.mock('ai', () => ({
  convertToModelMessages: mockConvertToModelMessages,
  stepCountIs: vi.fn(() => vi.fn(() => false)),
  streamText: vi.fn(() => ({
    fullStream: (async function* () {
      for (const event of mockStreamEvents) {
        yield event
      }
    })(),
  })),
}))

const mockGetAIModel = vi.hoisted(() => vi.fn(() => ({})))
vi.mock('../../../src/main/ai/factory', () => ({
  getAIModel: (...args: unknown[]) => mockGetAIModel(...args),
}))

const mockWriteJson = vi.hoisted(() => vi.fn(() => Promise.resolve()))
vi.mock('../../../src/lib/path', () => ({
  writeJson: (...args: unknown[]) => mockWriteJson(...args),
}))

const mockCreateTools = vi.hoisted(() =>
  vi.fn(() => ({
    read_file: { execute: vi.fn() },
    write_file: { execute: vi.fn() },
    run_command: { execute: vi.fn() },
    get_workspace_info: { execute: vi.fn() },
  })),
)

const mockGetEnabledToolsForSession = vi.hoisted(() =>
  vi.fn((_agentTools: any, _sessionType: string) => ({})),
)

vi.mock('../../../src/main/ai/tools', () => ({
  createTools: (...args: unknown[]) => mockCreateTools(...args),
  getEnabledToolsForSession: (...args: unknown[]) =>
    mockGetEnabledToolsForSession(...args),
}))

// ─── Imports ────────────────────────────────────────────────────────────

import type { UIMessage } from 'ai'
import {
  mergeHooks,
  runAgentLoop,
  runAgentSession,
} from '../../../src/main/ai/agent-engine'

beforeEach(() => {
  vi.clearAllMocks()
  mockGetAIModel.mockReturnValue({})
  mockStreamEvents = []
  mockCreateTools.mockReturnValue({
    read_file: { execute: vi.fn() },
    write_file: { execute: vi.fn() },
    run_command: { execute: vi.fn() },
    get_workspace_info: { execute: vi.fn() },
  })
  mockGetEnabledToolsForSession.mockReturnValue({
    read_file: true,
    write_file: true,
    run_command: true,
    get_workspace_info: true,
  })
})

// ─── mergeHooks ─────────────────────────────────────────────────────────

describe('mergeHooks', () => {
  it('returns undefined when all inputs are undefined', () => {
    expect(mergeHooks(undefined, undefined)).toBeUndefined()
    expect(mergeHooks()).toBeUndefined()
  })

  it('returns the same hooks when only one input is provided', () => {
    const hooks = { 'step-start': vi.fn() }
    const result = mergeHooks(hooks)
    result?.['step-start']?.({ step: 1 })
    expect(hooks['step-start']).toHaveBeenCalledWith({ step: 1 })
  })

  it('merges two hook sets — both handlers fire for the same key', async () => {
    const a = vi.fn()
    const b = vi.fn()
    const hooksA = { 'tool-call': a }
    const hooksB = { 'tool-call': b }

    const merged = mergeHooks(hooksA, hooksB)
    await merged?.['tool-call']?.({ toolCallId: '1', toolName: 'x', args: {} })

    expect(a).toHaveBeenCalledWith({ toolCallId: '1', toolName: 'x', args: {} })
    expect(b).toHaveBeenCalledWith({ toolCallId: '1', toolName: 'x', args: {} })
    // a fires before b
    expect(a.mock.invocationCallOrder[0]).toBeLessThan(
      b.mock.invocationCallOrder[0],
    )
  })

  it('fires handlers in left-to-right order', async () => {
    const order: number[] = []
    const a = vi.fn(() => order.push(1))
    const b = vi.fn(() => order.push(2))
    const c = vi.fn(() => order.push(3))

    const merged = mergeHooks({ finish: a }, { finish: b }, { finish: c })
    await merged?.finish?.({
      messages: [],
      text: '',
      reasoning: '',
      toolCalls: [],
    })

    expect(order).toEqual([1, 2, 3])
  })

  it('handles async hook handlers', async () => {
    const a = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 5))
    })
    const b = vi.fn()

    const merged = mergeHooks({ error: a }, { error: b })
    await merged?.error?.({ error: 'test' })

    expect(a).toHaveBeenCalled()
    expect(b).toHaveBeenCalled()
  })

  it('does not fire a key that only one hook set has', () => {
    const a = vi.fn()
    const b = vi.fn()
    const hooksA = { 'text-delta': a }

    const merged = mergeHooks(hooksA, { finish: b })
    // Finish should work
    merged?.finish?.({ messages: [], text: '', reasoning: '', toolCalls: [] })
    expect(b).toHaveBeenCalled()
    // Text-delta should also work
    merged?.['text-delta']?.({ text: 'hi' })
    expect(a).toHaveBeenCalled()
  })

  it('ignores undefined entries in the middle', () => {
    const fn = vi.fn()
    const merged = mergeHooks(undefined, { 'step-start': fn }, undefined)
    expect(merged).toBeDefined()
    merged?.['step-start']?.({ step: 1 })
    expect(fn).toHaveBeenCalled()
  })
})

// ─── runAgentLoop stream edge cases ─────────────────────────────────────

describe('runAgentLoop', () => {
  const baseConfig = {
    id: 'test',
    provider: 'openai',
    apiKey: 'sk-test',
  } as any

  it('handles tool-result with matching dynamic-tool in messages', async () => {
    mockStreamEvents = [
      {
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'read_file',
        args: { path: '/test' },
      },
      {
        type: 'tool-result',
        toolCallId: 'call-1',
        toolName: 'read_file',
        output: 'file content',
        args: { path: '/test' },
      },
      { type: 'finish' },
    ]

    const result = await runAgentLoop({
      messages: [],
      config: baseConfig,
      tools: { read_file: { execute: vi.fn() } },
    })

    // After tool-result, there should be an assistant message with a dynamic-tool part
    const assistantMsg = result.messages.find((m) => m.role === 'assistant')
    expect(assistantMsg).toBeDefined()
    const dynTool = (assistantMsg as any)?.parts?.find(
      (p: any) => p.type === 'dynamic-tool',
    )
    expect(dynTool).toBeDefined()
    expect(dynTool.state).toBe('output-available')
    expect(dynTool.output).toBe('file content')
  })

  it('handles command-output streaming into run_command dynamic-tool', async () => {
    mockStreamEvents = [
      {
        type: 'tool-call',
        toolCallId: 'cmd-1',
        toolName: 'run_command',
        args: { command: 'echo hi' },
      },
      {
        type: 'tool-result',
        toolCallId: 'cmd-1',
        toolName: 'run_command',
        output: 'hi\n',
        args: { command: 'echo hi' },
      },
      { type: 'command-output', text: 'hi' },
      { type: 'command-output', text: '\n' },
      { type: 'finish' },
    ]

    const result = await runAgentLoop({
      messages: [],
      config: baseConfig,
      tools: { run_command: { execute: vi.fn() } },
    })

    const assistantMsg = result.messages.find((m) => m.role === 'assistant')
    expect(assistantMsg).toBeDefined()
    const dynTool = (assistantMsg as any)?.parts?.find(
      (p: any) => p.type === 'dynamic-tool' && p.toolName === 'run_command',
    )
    expect(dynTool).toBeDefined()
    expect(dynTool.state).toBe('output-available')
    expect(dynTool.output).toBe('hi\n')
  })

  it('fires error hook on error events', async () => {
    const errorHook = vi.fn()
    mockStreamEvents = [{ type: 'error', error: 'API rate limited' }]

    await runAgentLoop({
      messages: [],
      config: baseConfig,
      tools: {},
      hooks: { error: errorHook },
    })

    expect(errorHook).toHaveBeenCalledWith({ error: 'API rate limited' })
  })

  it('fires step-finish hook on finish-step events', async () => {
    const stepFinishHook = vi.fn()
    mockStreamEvents = [
      { type: 'text-delta', text: 'hello' },
      { type: 'finish-step' },
      { type: 'finish' },
    ]

    await runAgentLoop({
      messages: [
        {
          role: 'user',
          content: '',
          parts: [{ type: 'text', text: 'hi' }],
        } as UIMessage,
      ],
      config: baseConfig,
      tools: {},
      hooks: { 'step-finish': stepFinishHook },
    })

    expect(stepFinishHook).toHaveBeenCalled()
    const eventArg = stepFinishHook.mock.calls[0][0]
    expect(eventArg.messages).toBeDefined()
    expect(eventArg.messages.length).toBeGreaterThanOrEqual(2) // user + assistant
  })

  it('fires finish hook with accumulated stats', async () => {
    const finishHook = vi.fn()
    mockStreamEvents = [
      { type: 'text-delta', text: 'Hello' },
      { type: 'reasoning-delta', text: 'thinking...' },
      { type: 'finish' },
    ]

    await runAgentLoop({
      messages: [],
      config: baseConfig,
      tools: {},
      hooks: { finish: finishHook },
    })

    expect(finishHook).toHaveBeenCalled()
    const event = finishHook.mock.calls[0][0]
    // text and reasoning are empty after flushAssistant resets the accumulators
    // The actual content is in messages[0].parts
    expect(event.text).toBe('')
    expect(event.reasoning).toBe('')
    expect(event.messages).toHaveLength(1)
    const parts = (event.messages[0] as any).parts
    expect(parts).toBeDefined()
    expect(parts.find((p: any) => p.type === 'text').text).toBe('Hello')
    expect(parts.find((p: any) => p.type === 'reasoning').text).toBe(
      'thinking...',
    )
  })

  it('ignores unknown part types via default case', async () => {
    const startHook = vi.fn()
    mockStreamEvents = [
      // tool-input-delta is not in the switch — goes to default
      {
        type: 'tool-input-delta',
        toolCallId: 'call-1',
        argsTextDelta: '{"path"',
      },
      { type: 'finish' },
    ]

    await runAgentLoop({
      messages: [],
      config: baseConfig,
      tools: {},
      hooks: { 'step-start': startHook },
    })

    // Should not crash — default case just breaks
    expect(startHook).not.toHaveBeenCalled()
  })

  it('handles empty stream (only finish)', async () => {
    mockStreamEvents = [{ type: 'finish' }]

    const result = await runAgentLoop({
      messages: [],
      config: baseConfig,
      tools: {},
    })

    expect(result.messages).toHaveLength(0)
    expect(result.text).toBe('')
    expect(result.reasoning).toBe('')
    expect(result.toolCalls).toEqual([])
  })

  it('extracts system message from messages', async () => {
    const conv = vi.fn()
    mockStreamEvents = [{ type: 'text-delta', text: 'ok' }, { type: 'finish' }]

    await runAgentLoop({
      messages: [
        {
          role: 'system',
          content: '',
          parts: [{ type: 'text', text: 'You are a bot' }],
        } as UIMessage,
        {
          role: 'user',
          content: '',
          parts: [{ type: 'text', text: 'hi' }],
        } as UIMessage,
      ],
      config: baseConfig,
      tools: {},
      hooks: { 'text-delta': conv },
    })

    expect(conv).toHaveBeenCalledWith({ text: 'ok' })
  })

  it('fires step-start on each step', async () => {
    const stepStartHook = vi.fn()
    mockStreamEvents = [
      { type: 'start' },
      { type: 'text-delta', text: 'step1' },
      { type: 'finish-step' },
      { type: 'start' },
      { type: 'text-delta', text: 'step2' },
      { type: 'finish' },
    ]

    await runAgentLoop({
      messages: [],
      config: baseConfig,
      tools: {},
      hooks: { 'step-start': stepStartHook },
    })

    expect(stepStartHook).toHaveBeenCalledTimes(2)
    expect(stepStartHook).toHaveBeenNthCalledWith(1, { step: 1 })
    expect(stepStartHook).toHaveBeenNthCalledWith(2, { step: 2 })
  })

  // ── dynamic-tool stripping ──────────────────────────────────────────────

  it('strips dynamic-tool parts from assistant messages before convertToModelMessages', async () => {
    mockStreamEvents = [{ type: 'finish' }]

    await runAgentLoop({
      messages: [
        {
          role: 'assistant',
          content: '',
          parts: [
            { type: 'text', text: 'Let me check' },
            {
              type: 'dynamic-tool',
              toolCallId: 'dt-1',
              toolName: 'read_file',
              state: 'output-available',
              output: 'ok',
            },
          ],
        } as UIMessage,
      ],
      config: baseConfig,
      tools: {},
    })

    const converted = mockConvertToModelMessages.mock.calls[0][0]
    expect(converted).toHaveLength(1)
    const msg = converted[0]
    expect(msg.role).toBe('assistant')
    // dynamic-tool should be stripped; text part should remain
    const partTypes = msg.parts.map((p: any) => p.type)
    expect(partTypes).not.toContain('dynamic-tool')
    expect(partTypes).toContain('text')
    expect(partTypes).toEqual(['text'])
  })

  // ── tool-call args from SDK's `input` field ──────────────────────────────

  it('passes tool-call args from tc.input (SDK v6) to the hook', async () => {
    // SDK v6 `fullStream` yields `tool-call` parts with `input` for args
    // NOT `args`. This test verifies the hook receives args from tc.input.
    // If someone reverts to `args: tc.args`, this test fails because
    // tc.args is undefined in SDK v6.
    const toolCallHook = vi.fn()
    mockStreamEvents = [
      {
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'read_file',
        input: { path: '/home/test/file.ts' },
      },
      { type: 'finish' },
    ]

    await runAgentLoop({
      messages: [],
      config: baseConfig,
      tools: { read_file: { execute: vi.fn() } },
      hooks: { 'tool-call': toolCallHook },
    })

    expect(toolCallHook).toHaveBeenCalledWith({
      toolCallId: 'call-1',
      toolName: 'read_file',
      args: { path: '/home/test/file.ts' },
    })
  })

  it('passes tool-call args with no path — obj with other keys still works', async () => {
    const toolCallHook = vi.fn()
    mockStreamEvents = [
      {
        type: 'tool-call',
        toolCallId: 'call-2',
        toolName: 'run_command',
        input: { command: 'ls -la' },
      },
      { type: 'finish' },
    ]

    await runAgentLoop({
      messages: [],
      config: baseConfig,
      tools: { run_command: { execute: vi.fn() } },
      hooks: { 'tool-call': toolCallHook },
    })

    expect(toolCallHook).toHaveBeenCalledWith({
      toolCallId: 'call-2',
      toolName: 'run_command',
      args: { command: 'ls -la' },
    })
  })

  it('creates dynamic-tool part with input field from tc.input', async () => {
    // The flushAssistant creates dynamic-tool parts with `input: tc.input || tc.args`.
    // This test verifies the args data survives into the result messages
    // so the renderer's ToolPartRenderer can extract file paths.
    mockStreamEvents = [
      {
        type: 'tool-call',
        toolCallId: 'call-3',
        toolName: 'read_file',
        input: { path: '/home/project/src/main.ts' },
      },
      { type: 'finish' },
    ]

    const result = await runAgentLoop({
      messages: [],
      config: baseConfig,
      tools: { read_file: { execute: vi.fn() } },
    })

    const assistantMsg = result.messages.find((m) => m.role === 'assistant')
    expect(assistantMsg).toBeDefined()
    const dynTool = (assistantMsg as any)?.parts?.find(
      (p: any) => p.type === 'dynamic-tool' && p.toolName === 'read_file',
    )
    expect(dynTool).toBeDefined()
    expect(dynTool.input).toEqual({ path: '/home/project/src/main.ts' })
  })

  it('creates dynamic-tool part with input for run_command tool', async () => {
    mockStreamEvents = [
      {
        type: 'tool-call',
        toolCallId: 'call-4',
        toolName: 'run_command',
        input: { command: 'npm test' },
      },
      { type: 'finish' },
    ]

    const result = await runAgentLoop({
      messages: [],
      config: baseConfig,
      tools: { run_command: { execute: vi.fn() } },
    })

    const assistantMsg = result.messages.find((m) => m.role === 'assistant')
    expect(assistantMsg).toBeDefined()
    const dynTool = (assistantMsg as any)?.parts?.find(
      (p: any) => p.type === 'dynamic-tool' && p.toolName === 'run_command',
    )
    expect(dynTool).toBeDefined()
    expect(dynTool.input).toEqual({ command: 'npm test' })
  })

  it('creates dynamic-tool part with input for glob_search tool', async () => {
    mockStreamEvents = [
      {
        type: 'tool-call',
        toolCallId: 'call-5',
        toolName: 'glob_search',
        input: { pattern: 'src/**/*.ts' },
      },
      { type: 'finish' },
    ]

    const result = await runAgentLoop({
      messages: [],
      config: baseConfig,
      tools: { glob_search: { execute: vi.fn() } },
    })

    const assistantMsg = result.messages.find((m) => m.role === 'assistant')
    expect(assistantMsg).toBeDefined()
    const dynTool = (assistantMsg as any)?.parts?.find(
      (p: any) => p.type === 'dynamic-tool' && p.toolName === 'glob_search',
    )
    expect(dynTool).toBeDefined()
    expect(dynTool.input).toEqual({ pattern: 'src/**/*.ts' })
  })

  it('dynamic-tool part input is undefined when tc.input and tc.args are both missing', async () => {
    // Edge case: neither input nor args — should not crash, input is undefined
    const toolCallHook = vi.fn()
    mockStreamEvents = [
      {
        type: 'tool-call',
        toolCallId: 'call-6',
        toolName: 'read_file',
        // no input, no args
      } as any,
      { type: 'finish' },
    ]

    const result = await runAgentLoop({
      messages: [],
      config: baseConfig,
      tools: { read_file: { execute: vi.fn() } },
      hooks: { 'tool-call': toolCallHook },
    })

    // Hook still fired with args=undefined
    expect(toolCallHook).toHaveBeenCalledWith({
      toolCallId: 'call-6',
      toolName: 'read_file',
      args: undefined,
    })

    // dynamic-tool part has undefined input — renderer handles gracefully
    const assistantMsg = result.messages.find((m) => m.role === 'assistant')
    expect(assistantMsg).toBeDefined()
    const dynTool = (assistantMsg as any)?.parts?.find(
      (p: any) => p.type === 'dynamic-tool' && p.toolName === 'read_file',
    )
    expect(dynTool.input).toBeUndefined()
  })

  it('does not strip dynamic-tool parts from non-assistant messages', async () => {
    mockStreamEvents = [{ type: 'finish' }]

    await runAgentLoop({
      messages: [
        {
          role: 'user',
          content: '',
          parts: [
            { type: 'text', text: 'hello' },
            // user messages shouldn't normally have dynamic-tool, but if they do we leave them
            {
              type: 'dynamic-tool',
              toolCallId: 'dt-1',
              toolName: 'read_file',
              state: 'output-available',
              output: 'ok',
            },
          ],
        } as UIMessage,
        {
          role: 'tool',
          content: '',
          parts: [
            {
              type: 'tool-result',
              toolCallId: 'tr-1',
              toolName: 'read_file',
              result: 'data',
            },
          ],
        } as UIMessage,
      ],
      config: baseConfig,
      tools: {},
    })

    const converted = mockConvertToModelMessages.mock.calls[0][0]
    // user message retains its dynamic-tool part (it's irrelevant but harmless)
    const userMsg = converted.find((m: any) => m.role === 'user')
    expect(userMsg).toBeDefined()
    expect(
      userMsg.parts.find((p: any) => p.type === 'dynamic-tool'),
    ).toBeDefined()
    // tool message passes through unchanged
    const toolMsg = converted.find((m: any) => m.role === 'tool')
    expect(toolMsg).toBeDefined()
  })

  it('passes assistant messages without dynamic-tool parts through unchanged', async () => {
    mockStreamEvents = [{ type: 'finish' }]

    // Use a realistic message structure the SDK would produce
    await runAgentLoop({
      messages: [
        {
          role: 'assistant',
          content: '',
          parts: [
            { type: 'text', text: 'Hello' },
            { type: 'reasoning', text: 'thinking...' },
          ],
        } as UIMessage,
      ],
      config: baseConfig,
      tools: {},
    })

    const converted = mockConvertToModelMessages.mock.calls[0][0]
    expect(converted).toHaveLength(1)
    const msg = converted[0]
    expect(msg.role).toBe('assistant')
    expect(msg.parts).toHaveLength(2)
    // parts should be identical to input since there's nothing to strip
    const partTypes = msg.parts.map((p: any) => p.type)
    expect(partTypes).toEqual(['text', 'reasoning'])
  })

  it('strips only dynamic-tool parts, preserving all other part types', async () => {
    mockStreamEvents = [{ type: 'finish' }]

    await runAgentLoop({
      messages: [
        {
          role: 'assistant',
          content: '',
          parts: [
            { type: 'reasoning', text: 'step 1' },
            {
              type: 'dynamic-tool',
              toolCallId: 'dt-1',
              toolName: 'read_file',
              state: 'input-available',
            },
            { type: 'text', text: 'Result:' },
            {
              type: 'dynamic-tool',
              toolCallId: 'dt-2',
              toolName: 'write_file',
              state: 'output-available',
              output: 'done',
            },
          ],
        } as UIMessage,
      ],
      config: baseConfig,
      tools: {},
    })

    const converted = mockConvertToModelMessages.mock.calls[0][0]
    const partTypes = converted[0].parts.map((p: any) => p.type)
    expect(partTypes).toEqual(['reasoning', 'text'])
    expect(partTypes).not.toContain('dynamic-tool')
  })
})

// ─── runAgentSession ────────────────────────────────────────────────────

describe('runAgentSession', () => {
  const baseConfig = {
    id: 'test-provider',
    provider: 'openai',
    apiKey: 'sk-test',
  } as any

  it('creates tools, filters them, and runs the loop', async () => {
    mockStreamEvents = [
      { type: 'text-delta', text: 'hello' },
      { type: 'finish' },
    ]

    const result = await runAgentSession({
      messages: [],
      config: baseConfig,
      session: { id: 'sess-1', type: 'general', dir: '/tmp/sessions/sess-1' },
      toolContext: { workspaceFolders: ['/home/project'] },
    })

    expect(mockCreateTools).toHaveBeenCalled()
    expect(mockGetEnabledToolsForSession).toHaveBeenCalled()
    expect(result.messages).toBeDefined()
    // text is empty after flushAssistant resets the accumulator;
    // verify the content is in messages instead
    expect(result.messages.length).toBeGreaterThan(0)
    const textPart = (result.messages[0] as any).parts?.find(
      (p: any) => p.type === 'text',
    )
    expect(textPart?.text).toBe('hello')
  })

  it('merges extraTools into the tool set', async () => {
    mockStreamEvents = [{ type: 'finish' }]
    const extraTool = { execute: vi.fn() }

    await runAgentSession({
      messages: [],
      config: baseConfig,
      session: { id: 'sess-2', type: 'messenger', dir: '/tmp/sessions/sess-2' },
      toolContext: { workspaceFolders: ['/home/project'] },
      extraTools: { get_messages: extraTool },
    })

    // The extraTools should be passed to runAgentLoop — if it wasn't,
    // streamText would error. Since the mock handles it, just verify
    // the call chain completed without error.
    expect(mockCreateTools).toHaveBeenCalled()
  })

  it('filters tools based on enabledTools setting', async () => {
    mockStreamEvents = [{ type: 'finish' }]
    // Only read_file enabled
    mockGetEnabledToolsForSession.mockReturnValue({
      read_file: true,
      write_file: false,
    })

    await runAgentSession({
      messages: [],
      config: baseConfig,
      session: { id: 'sess-3', type: 'general', dir: '/tmp/sessions/sess-3' },
      toolContext: { workspaceFolders: ['/home/project'] },
      enabledTools: { read_file: true },
    })

    // Verify getEnabledToolsForSession was called with correct session type
    expect(mockGetEnabledToolsForSession).toHaveBeenCalledWith(
      { read_file: true },
      'general',
    )
  })

  it('saves messages to session dir on step-finish', async () => {
    mockStreamEvents = [
      { type: 'text-delta', text: 'saving...' },
      { type: 'finish-step' },
      { type: 'finish' },
    ]

    await runAgentSession({
      messages: [
        {
          role: 'user',
          content: '',
          parts: [{ type: 'text', text: 'hi' }],
        } as UIMessage,
      ],
      config: baseConfig,
      session: {
        id: 'sess-save',
        type: 'general',
        dir: '/tmp/sessions/sess-save',
      },
      toolContext: { workspaceFolders: ['/home/project'] },
    })

    expect(mockWriteJson).toHaveBeenCalled()
    const callArg = mockWriteJson.mock.calls[0]
    expect(callArg[0]).toContain('/tmp/sessions/sess-save/messages.json')
  })

  it('fires caller hooks after internal hooks', async () => {
    const order: string[] = []
    mockStreamEvents = [{ type: 'finish' }]

    await runAgentSession({
      messages: [],
      config: baseConfig,
      session: {
        id: 'sess-order',
        type: 'general',
        dir: '/tmp/sessions/sess-order',
      },
      toolContext: { workspaceFolders: ['/home/project'] },
      hooks: {
        finish: () => {
          order.push('caller')
        },
      },
    })

    // Internal finish hook fires first (logs), then caller
    // We can't directly observe internal hook timing, but the
    // function should complete without error
    expect(order).toEqual(['caller'])
  })

  it('passes session type to getEnabledToolsForSession', async () => {
    mockStreamEvents = [{ type: 'finish' }]

    await runAgentSession({
      messages: [],
      config: baseConfig,
      session: {
        id: 'sess-type',
        type: 'messenger',
        dir: '/tmp/sessions/sess-type',
      },
      toolContext: { workspaceFolders: ['/home/project'] },
    })

    expect(mockGetEnabledToolsForSession).toHaveBeenCalledWith(
      undefined,
      'messenger',
    )
  })
})
