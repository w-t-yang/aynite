import type {
  ChatMessage,
  ReasoningPart,
  TextPart,
  ToolCallPart,
  ToolResultPart,
} from '../../../../lib/types/chat'

export function genId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Append text delta to the last assistant message.
 *
 * Logic:
 * 1. If the last message is assistant and a simple string, it just appends.
 * 2. If the last message uses complex parts, it finds the last TextPart to append to,
 *    or adds a new TextPart if the last part wasn't text.
 */
export function appendToAssistant(
  prev: ChatMessage[],
  text: string,
): ChatMessage[] {
  const last = prev[prev.length - 1]
  if (last && last.role === 'assistant') {
    if (typeof last.content === 'string') {
      return [...prev.slice(0, -1), { ...last, content: last.content + text }]
    }

    // It's an array of parts
    const content = [...last.content]
    const lastPart = content[content.length - 1]
    if (lastPart && lastPart.type === 'text') {
      content[content.length - 1] = { ...lastPart, text: lastPart.text + text }
    } else {
      content.push({ type: 'text', text })
    }
    return [...prev.slice(0, -1), { ...last, content }]
  }

  return [
    ...prev,
    {
      id: genId(),
      role: 'assistant',
      content: text,
      createdAt: Date.now(),
    },
  ]
}

/**
 * Append reasoning delta to the last assistant message.
 *
 * Logic:
 * 1. Always ensures the content is converted to an array of parts (since reasoning
 *    is a distinct metadata block and shouldn't be mixed into plain text).
 * 2. Finds the last ReasoningPart to append to, or adds a new one.
 */
export function appendReasoningToAssistant(
  prev: ChatMessage[],
  reasoning: string,
): ChatMessage[] {
  const last = prev[prev.length - 1]
  if (last && last.role === 'assistant') {
    if (typeof last.content === 'string') {
      return [
        ...prev.slice(0, -1),
        {
          ...last,
          content: [
            { type: 'text', text: last.content } as TextPart,
            { type: 'reasoning', text: reasoning } as ReasoningPart,
          ],
        },
      ]
    }

    const content = [...last.content]
    const lastPart = content[content.length - 1]
    if (lastPart && lastPart.type === 'reasoning') {
      content[content.length - 1] = {
        ...lastPart,
        text: lastPart.text + reasoning,
      }
    } else {
      content.push({ type: 'reasoning', text: reasoning })
    }
    return [...prev.slice(0, -1), { ...last, content }]
  }

  return [
    ...prev,
    {
      id: genId(),
      role: 'assistant',
      content: [{ type: 'reasoning', text: reasoning }],
      createdAt: Date.now(),
    },
  ]
}

/**
 * Append tool input delta (streaming args) to the last tool call in assistant message.
 *
 * Reason to keep separate:
 * Unlike text/reasoning which usually append to the VERY LAST part, tool input deltas
 * might arrive out of order if multiple tools are streaming, so we MUST find the
 * specific tool-call part by its toolCallId.
 */
export function appendToolInputDeltaToAssistant(
  prev: ChatMessage[],
  id: string,
  delta: string,
): ChatMessage[] {
  const last = prev[prev.length - 1]
  if (last && last.role === 'assistant' && Array.isArray(last.content)) {
    const content = [...last.content]
    const toolCallIdx = content.findIndex(
      (p) => p.type === 'tool-call' && p.toolCallId === id,
    )

    if (toolCallIdx !== -1) {
      const part = content[toolCallIdx] as ToolCallPart
      // SDK v6.0.169 uses 'input' as string during streaming phases or object once done.
      // We treat it as string accumulation here.
      const currentInput = typeof part.input === 'string' ? part.input : ''
      content[toolCallIdx] = { ...part, input: currentInput + delta }
      return [...prev.slice(0, -1), { ...last, content }]
    }
  }
  return prev
}

/**
 * Append or update a full part (like tool-call) in the last assistant message.
 *
 * Logic:
 * 1. Checks if a part with the same toolCallId already exists (e.g. replacing a
 *    partially streamed tool-call with a finished one).
 * 2. If it exists, updates it in-place. Otherwise, appends to the end.
 */
export function appendPartToAssistant(
  prev: ChatMessage[],
  part: TextPart | ReasoningPart | ToolCallPart | ToolResultPart,
): ChatMessage[] {
  const last = prev[prev.length - 1]
  if (last && last.role === 'assistant') {
    const content =
      typeof last.content === 'string'
        ? [{ type: 'text', text: last.content } as TextPart]
        : [...last.content]

    // If it's a tool-call or tool-result, check for existing ID to update
    if (part.type === 'tool-call' || part.type === 'tool-result') {
      const existingIdx = content.findIndex(
        (p) =>
          (p.type === 'tool-call' || p.type === 'tool-result') &&
          p.toolCallId === part.toolCallId,
      )

      if (existingIdx !== -1) {
        content[existingIdx] = part
        return [...prev.slice(0, -1), { ...last, content }]
      }
    }

    content.push(part)
    return [...prev.slice(0, -1), { ...last, content }]
  }

  return [
    ...prev,
    {
      id: genId(),
      role: 'assistant',
      content: [part],
      createdAt: Date.now(),
    },
  ]
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
