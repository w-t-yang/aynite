/**
 * Agent Engine — hooks-based streamText() loop + unified session runner.
 *
 * runAgentLoop() — low-level loop, fires typed hooks at meaningful points.
 * runAgentSession() — high-level unified entry point for ALL session types:
 *       creates tools, sets up internal hooks (logging + save), merges
 *       caller hooks, delegates to runAgentLoop().
 *
 * Each session type (general GUI, messenger bot, flow) calls runAgentSession()
 * with their own hooks for type-specific behavior (GUI emission, working reply)
 * without duplicating tool assembly or loop logic.
 */

import path from 'node:path'
import type { UIMessage } from 'ai'
import { convertToModelMessages, stepCountIs, streamText } from 'ai'
import { writeJson } from '../../lib/path'
import type { ToolContext } from '../../lib/types/ai'
import { createMessage } from '../../lib/types/chat'
import type { AIProvider } from './factory'
import { getAIModel } from './factory'
import { createTools, getEnabledToolsForSession } from './tools'

// ─── Hook Types ─────────────────────────────────────────────────────────

export interface AgentHooks {
  'step-start': (event: { step: number }) => void
  'text-delta': (event: { text: string }) => void
  'reasoning-delta': (event: { text: string }) => void
  'tool-call': (event: {
    toolCallId: string
    toolName: string
    args: any
  }) => void
  'tool-result': (event: {
    toolCallId: string
    toolName: string
    input: any
    output: any
  }) => void
  'command-output': (event: { text: string }) => void
  'step-finish': (event: { messages: UIMessage[] }) => void
  error: (event: { error: string }) => void
  finish: (event: {
    messages: UIMessage[]
    text: string
    reasoning: string
    toolCalls: any[]
  }) => void
}

// ─── Low-Level Loop ─────────────────────────────────────────────────────

export interface AgentLoopOptions {
  messages: UIMessage[]
  config: AIProvider
  tools: Record<string, any>
  providerOptions?: Record<string, any>
  maxSteps?: number
  hooks?: Partial<AgentHooks>
}

export interface AgentLoopResult {
  messages: UIMessage[]
  text: string
  reasoning: string
  toolCalls: any[]
}

export async function runAgentLoop(
  options: AgentLoopOptions,
): Promise<AgentLoopResult> {
  const {
    messages,
    config,
    tools,
    providerOptions,
    maxSteps = 1000,
    hooks,
  } = options

  const model = getAIModel(config)

  // ── Extract system message ─────────────────────────────────────────────
  const systemMessage = messages.find((m) => m.role === 'system')
  const chatMessages = messages.filter((m) => m.role !== 'system')
  const modelMessages = await convertToModelMessages(chatMessages, {
    tools: tools as any,
    ignoreIncompleteToolCalls: true,
  })

  const system = systemMessage
    ? systemMessage.parts
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map((p) => p.text)
        .join('\n')
    : undefined

  // ── Start streaming ────────────────────────────────────────────────────
  const result = streamText({
    model,
    system,
    messages: modelMessages,
    tools,
    stopWhen: stepCountIs(maxSteps),
    providerOptions: providerOptions as any,
  })

  // ── Loop state ─────────────────────────────────────────────────────────
  const loopMessages: UIMessage[] = []
  let textAccum = ''
  let reasoningAccum = ''
  let currentStepToolCalls: any[] = []
  let stepCount = 0

  const flushAssistant = () => {
    if (textAccum || reasoningAccum || currentStepToolCalls.length > 0) {
      const parts: any[] = []
      if (reasoningAccum) {
        parts.push({ type: 'reasoning', text: reasoningAccum, state: 'done' })
      }
      if (textAccum) {
        parts.push({ type: 'text', text: textAccum, state: 'done' })
      }
      for (const tc of currentStepToolCalls) {
        parts.push({
          type: 'dynamic-tool',
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          state: 'input-available',
          input: tc.input || tc.args,
        } as any)
      }
      loopMessages.push(createMessage('assistant', parts))
      textAccum = ''
      reasoningAccum = ''
      currentStepToolCalls = []
    }
  }

  const fullToolCalls: any[] = []

  for await (const part of result.fullStream) {
    switch (part.type) {
      case 'start':
        stepCount++
        hooks?.['step-start']?.({ step: stepCount })
        break

      case 'text-delta':
        textAccum += part.text
        hooks?.['text-delta']?.({ text: part.text })
        break

      case 'reasoning-delta':
        reasoningAccum += part.text
        hooks?.['reasoning-delta']?.({ text: part.text })
        break

      case 'tool-call': {
        const tc = part as any
        fullToolCalls.push(tc)
        const idx = currentStepToolCalls.findIndex(
          (t) => t.toolCallId === tc.toolCallId,
        )
        if (idx !== -1) currentStepToolCalls[idx] = tc
        else currentStepToolCalls.push(tc)
        hooks?.['tool-call']?.({
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          args: tc.args,
        })
        break
      }

      case 'tool-result': {
        const tr = part as any
        flushAssistant()
        if (loopMessages.length > 0) {
          const last = loopMessages[loopMessages.length - 1]
          const parts = [...last.parts]
          const idx = parts.findIndex(
            (p: any) =>
              p.type === 'dynamic-tool' && p.toolCallId === tr.toolCallId,
          )
          if (idx !== -1) {
            parts[idx] = {
              ...parts[idx],
              state: 'output-available',
              output: tr.output,
            } as any
            loopMessages[loopMessages.length - 1] = { ...last, parts }
          }
        }
        hooks?.['tool-result']?.({
          toolCallId: tr.toolCallId,
          toolName: tr.toolName,
          input: tr.args || tr.input,
          output: tr.output,
        })
        break
      }

      // command-output is a non-standard event from run_command tool streaming
      case 'command-output' as any: {
        const streamPart = part as any
        const cmdText = String(streamPart.text || '')
        if (cmdText && loopMessages.length > 0) {
          const last = loopMessages[loopMessages.length - 1]
          const parts = [...last.parts]
          for (let i = parts.length - 1; i >= 0; i--) {
            const p = parts[i] as any
            if (
              p.type === 'dynamic-tool' &&
              p.toolName === 'run_command' &&
              (p.state === 'input-available' || p.state === 'executing')
            ) {
              parts[i] = {
                ...p,
                state: 'executing',
                output: (p.output || '') + cmdText,
              } as any
              loopMessages[loopMessages.length - 1] = { ...last, parts }
              break
            }
          }
        }
        hooks?.['command-output']?.({ text: cmdText })
        break
      }

      case 'finish-step': {
        flushAssistant()
        await hooks?.['step-finish']?.({
          messages: [...messages, ...loopMessages],
        })
        break
      }

      case 'error': {
        flushAssistant()
        hooks?.error?.({ error: String(part.error) })
        break
      }

      case 'finish': {
        flushAssistant()
        const allMessages = [...messages, ...loopMessages]
        hooks?.finish?.({
          messages: allMessages,
          text: textAccum,
          reasoning: reasoningAccum,
          toolCalls: fullToolCalls,
        })
        break
      }

      default:
        // Ignore unknown part types (tool-input-delta, etc.)
        break
    }
  }

  return {
    messages: [...messages, ...loopMessages],
    text: textAccum,
    reasoning: reasoningAccum,
    toolCalls: fullToolCalls,
  }
}

// ─── High-Level Session Runner ──────────────────────────────────────────

export interface AgentSessionOptions {
  messages: UIMessage[]
  config: AIProvider
  providerOptions?: Record<string, any>

  session: {
    id: string
    type: 'general' | 'messenger' | 'flow'
    /** Directory where messages.json is written during incremental saves */
    dir: string
  }

  toolContext: ToolContext
  enabledTools?: Record<string, boolean>
  extraTools?: Record<string, any>
  hooks?: Partial<AgentHooks>
}

export interface AgentSessionResult {
  messages: UIMessage[]
  text: string
  reasoning: string
  toolCalls: any[]
}

export async function runAgentSession(
  options: AgentSessionOptions,
): Promise<AgentSessionResult> {
  const {
    messages,
    config,
    providerOptions,
    session,
    toolContext,
    enabledTools,
    extraTools,
    hooks: callerHooks,
  } = options

  // ── 1. Create base tools from context ──────────────────────────────────
  const baseTools = createTools(toolContext)

  // ── 2. Filter tools by agent settings + session type ───────────────────
  const toolSettings = getEnabledToolsForSession(enabledTools, session.type)
  const tools: Record<string, any> = {}
  for (const [name, tool] of Object.entries(baseTools)) {
    if (toolSettings[name] !== false) {
      tools[name] = tool
    }
  }

  // ── 3. Add type-specific tools ─────────────────────────────────────────
  if (extraTools) {
    Object.assign(tools, extraTools)
  }

  // ── 4. Build internal hooks (logging + incremental save) ───────────────
  const prefix = `[Agent ${session.type}/${session.id}]`

  const internalHooks: Partial<AgentHooks> = {
    'step-start': ({ step }) => console.log(`${prefix} step ${step} started`),
    'tool-call': ({ toolName, toolCallId }) =>
      console.log(`${prefix} tool-call: ${toolName} (id: ${toolCallId})`),
    'tool-result': ({ toolName, output }) => {
      const raw = output === undefined ? '' : output
      const preview =
        typeof raw === 'string'
          ? raw.slice(0, 100)
          : JSON.stringify(raw).slice(0, 100)
      console.log(`${prefix} tool-result: ${toolName} (${preview})`)
    },
    'command-output': ({ text }) =>
      console.log(`${prefix} command-output: ${text.slice(0, 100)}`),
    error: ({ error }) => console.error(`${prefix} stream error: ${error}`),
    'step-finish': async ({ messages: allMessages }) => {
      await writeJson(path.join(session.dir, 'messages.json'), allMessages)
    },
    finish: ({ text, reasoning, toolCalls }) => {
      console.log(
        `${prefix} finished: text=${text.length} chars, reasoning=${reasoning.length} chars, toolCalls=${toolCalls.length}`,
      )
    },
  }

  // ── 5. Merge internal hooks with caller hooks ──────────────────────────
  const merged = mergeHooks(internalHooks, callerHooks)

  // ── 6. Log session context before the loop ─────────────────────────────
  const configuredToolNames = enabledTools
    ? Object.keys(enabledTools).filter((k) => enabledTools[k] !== false)
    : []
  const sentToolNames = Object.keys(tools)
  const modelLabel = config.name || config.model || config.id
  console.log(
    `[Agent] session=${session.type}/${session.id} provider=${config.provider}/${modelLabel} ` +
      `configuredTools=[${configuredToolNames.join(', ')}] ` +
      `sentTools=[${sentToolNames.join(', ')}]`,
  )

  // ── 7. Run the loop ────────────────────────────────────────────────────
  return runAgentLoop({
    messages,
    config,
    tools,
    providerOptions,
    hooks: merged,
  })
}

// ─── Helper: merge multiple partial hooks objects ────────────────────────

export function mergeHooks(
  ...hooksList: (Partial<AgentHooks> | undefined)[]
): Partial<AgentHooks> | undefined {
  const defined = hooksList.filter(Boolean) as Partial<AgentHooks>[]
  if (defined.length === 0) return undefined

  const result: Partial<AgentHooks> = {}
  const allKeys = new Set<string>()
  for (const h of defined) {
    for (const k of Object.keys(h)) allKeys.add(k)
  }

  for (const key of allKeys) {
    const handlers = defined.map((h) => (h as any)[key]).filter(Boolean)
    if (handlers.length > 0) {
      ;(result as any)[key] = async (event: any) => {
        for (const handler of handlers) await handler(event)
      }
    }
  }

  return result
}
