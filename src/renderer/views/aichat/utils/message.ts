import type { UIMessage } from 'ai'

export function genId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Helper to get text content from a UIMessage for copying/exporting.
 */
export function getMessageText(msg: UIMessage): string {
  const role = msg.role.toUpperCase()
  const parts = msg.parts || []
  const content = parts
    .map((p) => {
      switch (p.type) {
        case 'text':
          return p.text
        case 'reasoning':
          return `\n[Thinking]\n${p.text}\n`
        case 'dynamic-tool': {
          const name = p.toolName || 'tool'
          const input = p.input
            ? `\nInput: ${typeof p.input === 'string' ? p.input : JSON.stringify(p.input, null, 2)}`
            : ''
          const output = p.output ? `\nOutput:\n${p.output}` : ''
          return `\n[Tool: ${name}${p.state ? ` (${p.state})` : ''}]${input}${output}\n`
        }
        default:
          return ''
      }
    })
    .join('\n')

  return `[${role}]\n${content.trim()}`
}

export function appendToAssistant(
  prev: UIMessage[],
  text: string,
): UIMessage[] {
  const last = prev[prev.length - 1]
  if (last && last.role === 'assistant') {
    const parts = [...last.parts]
    const lastPart = parts[parts.length - 1]
    if (lastPart && lastPart.type === 'text') {
      const idx = parts.length - 1
      parts[idx] = { ...lastPart, text: lastPart.text + text }
    } else {
      parts.push({ type: 'text', text, state: 'streaming' })
    }
    return [...prev.slice(0, -1), { ...last, parts }]
  }

  return [
    ...prev,
    {
      id: genId(),
      role: 'assistant',
      parts: [{ type: 'text', text, state: 'streaming' }],
    },
  ]
}

export function appendReasoningToAssistant(
  prev: UIMessage[],
  reasoning: string,
): UIMessage[] {
  const last = prev[prev.length - 1]
  if (last && last.role === 'assistant') {
    const parts = [...last.parts]
    const lastPart = parts[parts.length - 1]
    if (lastPart && lastPart.type === 'reasoning') {
      const idx = parts.length - 1
      parts[idx] = { ...lastPart, text: lastPart.text + reasoning }
    } else {
      parts.push({ type: 'reasoning', text: reasoning, state: 'streaming' })
    }
    return [...prev.slice(0, -1), { ...last, parts }]
  }

  return [
    ...prev,
    {
      id: genId(),
      role: 'assistant',
      parts: [{ type: 'reasoning', text: reasoning, state: 'streaming' }],
    },
  ]
}

export function appendPartToAssistant(
  prev: UIMessage[],
  part: { toolCallId: string; toolName: string; input?: unknown },
): UIMessage[] {
  const last = prev[prev.length - 1]
  if (last && last.role === 'assistant') {
    const parts = [...last.parts]

    // Check if we already have this tool call
    const existingIdx = parts.findIndex(
      (p) => p.type === 'dynamic-tool' && p.toolCallId === part.toolCallId,
    )

    if (existingIdx !== -1) {
      parts[existingIdx] = {
        ...parts[existingIdx],
        state: 'input-available',
        input: part.input,
      } as any
    } else {
      parts.push({
        type: 'dynamic-tool',
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        state: 'input-available',
        input: part.input,
      } as any)
    }

    return [...prev.slice(0, -1), { ...last, parts }]
  }

  return [
    ...prev,
    {
      id: genId(),
      role: 'assistant',
      parts: [
        {
          type: 'dynamic-tool',
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          state: 'input-available',
          input: part.input,
        } as any,
      ],
    },
  ]
}

export function updateToolResult(
  prev: UIMessage[],
  part: { toolCallId: string; toolName: string; output?: unknown },
): UIMessage[] {
  // Find the last assistant message that contains a matching dynamic-tool part
  for (let i = prev.length - 1; i >= 0; i--) {
    const msg = prev[i]
    if (msg.role !== 'assistant') continue

    const parts = [...msg.parts]
    const idx = parts.findIndex(
      (p) => p.type === 'dynamic-tool' && p.toolCallId === part.toolCallId,
    )

    if (idx !== -1) {
      parts[idx] = {
        ...parts[idx],
        state: 'output-available',
        output: part.output,
      } as any
      return [...prev.slice(0, i), { ...msg, parts }, ...prev.slice(i + 1)]
    }
  }

  // Fallback: no matching tool call found, append as new assistant message
  return [
    ...prev,
    {
      id: genId(),
      role: 'assistant',
      parts: [
        {
          type: 'dynamic-tool',
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          state: 'output-available',
          input: undefined,
          output: part.output,
        } as any,
      ],
    },
  ]
}

/**
 * Append streaming command output to the most recent run_command tool part.
 * Updates the output incrementally as the command runs.
 */
export function appendCommandOutput(
  prev: UIMessage[],
  text: string,
): UIMessage[] {
  // Find the last assistant message with a run_command dynamic-tool part still executing
  for (let i = prev.length - 1; i >= 0; i--) {
    const msg = prev[i]
    if (msg.role !== 'assistant') continue

    const parts = [...msg.parts]
    // Search from the end for the last run_command tool part
    for (let j = parts.length - 1; j >= 0; j--) {
      const p = parts[j] as any
      if (
        p.type === 'dynamic-tool' &&
        p.toolName === 'run_command' &&
        (p.state === 'input-available' || p.state === 'executing')
      ) {
        const currentOutput = (p as any).output || ''
        parts[j] = {
          ...p,
          state: 'executing',
          output: currentOutput + text,
        } as any
        return [...prev.slice(0, i), { ...msg, parts }, ...prev.slice(i + 1)]
      }
    }
  }
  return prev
}

export function appendToolInputDeltaToAssistant(
  prev: UIMessage[],
  id: string,
  delta: string,
): UIMessage[] {
  const last = prev[prev.length - 1]
  if (last && last.role === 'assistant') {
    const parts = [...last.parts]
    const idx = parts.findIndex(
      (p) => p.type === 'dynamic-tool' && p.toolCallId === id,
    )

    if (idx !== -1) {
      const p = parts[idx] as any
      const currentInput =
        typeof p.input === 'string' ? p.input : JSON.stringify(p.input || '')
      parts[idx] = {
        ...p,
        input: currentInput + delta,
        state: 'input-streaming',
      } as any
      return [...prev.slice(0, -1), { ...last, parts }]
    }
  }
  return prev
}

export const isErrorMessage = (content: any) => {
  if (!content) return false
  const c =
    typeof content === 'string' ? content.trim() : JSON.stringify(content)
  return (
    c.startsWith('Error:') ||
    c.startsWith('Execution Error:') ||
    c.startsWith('**') ||
    c.includes('"status": "error"')
  )
}

export function findUnfulfilledToolCalls(messages: UIMessage[]): any[] {
  const allCalls: any[] = []

  for (const m of messages) {
    for (const p of m.parts) {
      if (p.type === 'dynamic-tool') {
        if (p.state === 'input-available' || p.state === 'input-streaming') {
          allCalls.push(p)
        } else if (p.state === 'output-available') {
          const idx = allCalls.findIndex((c) => c.toolCallId === p.toolCallId)
          if (idx !== -1) allCalls.splice(idx, 1)
        }
      }
    }
  }

  return allCalls
}
