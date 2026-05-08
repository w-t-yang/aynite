import type { UIMessage } from 'ai'
import type { ChatMessage, StreamPart } from '../../../../lib/types/chat'

export function genId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Helper to get text content from a UIMessage for legacy components.
 */
export function getMessageText(msg: ChatMessage): string {
  return msg.parts
    .filter((p): p is any => p.type === 'text')
    .map((p) => p.text)
    .join('')
}

export function appendToAssistant(
  prev: ChatMessage[],
  text: string,
): ChatMessage[] {
  const last = prev[prev.length - 1]
  if (last && last.role === 'assistant') {
    const parts = [...(last.parts || [])]
    const lastPart = parts[parts.length - 1]
    if (lastPart && lastPart.type === 'text') {
      parts[parts.length - 1] = { ...lastPart, text: lastPart.text + text }
    } else {
      parts.push({ type: 'text', text })
    }
    return [...prev.slice(0, -1), { ...last, parts }]
  }

  return [
    ...prev,
    {
      id: genId(),
      role: 'assistant',
      parts: [{ type: 'text', text }],
      createdAt: new Date(),
    } as UIMessage,
  ]
}

export function appendReasoningToAssistant(
  prev: ChatMessage[],
  reasoning: string,
): ChatMessage[] {
  const last = prev[prev.length - 1]
  if (last && last.role === 'assistant') {
    const parts = [...(last.parts || [])]
    const lastPart = parts[parts.length - 1]
    if (lastPart && lastPart.type === 'reasoning') {
      parts[parts.length - 1] = {
        ...lastPart,
        text: (lastPart as any).text + reasoning,
      }
    } else {
      parts.push({ type: 'reasoning', text: reasoning } as any)
    }
    return [...prev.slice(0, -1), { ...last, parts }]
  }

  return [
    ...prev,
    {
      id: genId(),
      role: 'assistant',
      parts: [{ type: 'reasoning', text: reasoning } as any],
      createdAt: new Date(),
    } as UIMessage,
  ]
}

export function appendPartToAssistant(
  prev: ChatMessage[],
  part: StreamPart & { type: 'tool-call' | 'tool-result' },
): ChatMessage[] {
  const last = prev[prev.length - 1]
  if (last && last.role === 'assistant') {
    const parts = [...(last.parts || [])]
    
    // Find if we already have this tool call in parts
    const existingIdx = parts.findIndex(p => 
       ((p.type as string) === 'tool' || (p.type as string).startsWith('tool-') || (p.type as string) === 'dynamic-tool') && 
       (p as any).toolCallId === part.toolCallId
    )

    const uiPart: any = {
      type: 'dynamic-tool',
      toolCallId: part.toolCallId,
      toolName: part.toolName,
    }

    if (part.type === 'tool-call') {
      uiPart.state = 'input-available'
      uiPart.input = part.args
    } else {
      uiPart.state = 'output-available'
      uiPart.output = part.result ?? (part as any).output
      // Preserve input if we can find it
      if (existingIdx !== -1) {
        uiPart.input = (parts[existingIdx] as any).input
      }
    }

    if (existingIdx !== -1) {
      parts[existingIdx] = { ...parts[existingIdx], ...uiPart }
    } else {
      parts.push(uiPart)
    }

    return [...prev.slice(0, -1), { ...last, parts }]
  }

  // Create new assistant message if needed
  return [
    ...prev,
    {
      id: genId(),
      role: 'assistant',
      parts: [{
        type: 'dynamic-tool',
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        state: part.type === 'tool-call' ? 'input-available' : 'output-available',
        input: (part as any).args,
        output: (part as any).result
      } as any],
      createdAt: new Date(),
    } as UIMessage,
  ]
}

export function appendToolInputDeltaToAssistant(
  prev: ChatMessage[],
  id: string,
  delta: string,
): ChatMessage[] {
  const last = prev[prev.length - 1]
  if (last && last.role === 'assistant') {
    const parts = [...(last.parts || [])]
    const idx = parts.findIndex(p => (p as any).toolCallId === id)

    if (idx !== -1) {
      const p = parts[idx] as any
      const currentInput = typeof p.input === 'string' ? p.input : JSON.stringify(p.input || '')
      parts[idx] = { ...p, input: currentInput + delta, state: 'input-streaming' }
      return [...prev.slice(0, -1), { ...last, parts }]
    }
  }
  return prev
}

export const isErrorMessage = (content: any) => {
  if (!content) return false
  const c = typeof content === 'string' ? content.trim() : JSON.stringify(content)
  return (
    c.startsWith('Error:') ||
    c.startsWith('Execution Error:') ||
    c.startsWith('**') ||
    c.includes('"status": "error"')
  )
}

export function findUnfulfilledToolCalls(
  messages: ChatMessage[],
): any[] {
  const allCalls: any[] = []

  for (const m of messages) {
    for (const p of m.parts) {
      if ((p as any).toolCallId) {
        if ((p as any).state === 'input-available' || (p as any).state === 'input-streaming') {
           allCalls.push(p)
        } else if ((p as any).state === 'output-available') {
           const idx = allCalls.findIndex(c => c.toolCallId === (p as any).toolCallId)
           if (idx !== -1) allCalls.splice(idx, 1)
        }
      }
    }
  }

  return allCalls
}
