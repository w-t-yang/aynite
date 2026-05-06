import type { ChatMessage } from './types'

function hasReasoning(m: ChatMessage): boolean {
  return !!(
    m.thinking ||
    m.content.includes('<thought>') ||
    m.content.includes('<think>')
  )
}

export function prepareMessagesForApi(fullHistory: ChatMessage[]): any[] {
  const cleanMessages: any[] = []

  for (let i = 0; i < fullHistory.length; i++) {
    const m = fullHistory[i]

    if (m.role === 'user' || m.role === 'system') {
      cleanMessages.push({ role: m.role, content: m.content || '' })
      continue
    }

    if (m.role === 'tool') {
      continue
    }

    if (m.role === 'assistant') {
      const parts: any[] = []

      if (hasReasoning(m)) {
        parts.push({
          type: 'reasoning',
          text:
            m.thinking ||
            m.content.match(
              /<(?:thought|think)>([\s\S]*?)<\/(?:thought|think)>/,
            )?.[1] ||
            '',
        })
      }
      const cleanContent = m.content
        .replace(/<(?:thought|think)>[\s\S]*?<\/(?:thought|think)>/g, '')
        .trim()
      if (cleanContent) {
        parts.push({ type: 'text', text: cleanContent })
      }

      const availableResults = new Map<string, ChatMessage>()
      let j = i + 1
      while (j < fullHistory.length && fullHistory[j].role === 'tool') {
        const toolMsg = fullHistory[j]
        if (toolMsg.tool_call_id) {
          availableResults.set(toolMsg.tool_call_id, toolMsg)
        }
        j++
      }

      const validCalls: any[] = []
      if (m.tool_calls && m.tool_calls.length > 0) {
        for (const c of m.tool_calls) {
          if (c.toolCallId && availableResults.has(c.toolCallId)) {
            validCalls.push(c)
            parts.push({
              type: 'tool-call',
              toolCallId: c.toolCallId,
              toolName: c.toolName,
              input: typeof c.args === 'string' ? JSON.parse(c.args) : c.args,
            })
          }
        }
      }

      if (parts.length > 0) {
        cleanMessages.push({
          role: 'assistant',
          content:
            parts.length === 1 && parts[0].type === 'text'
              ? parts[0].text
              : parts,
        })

        for (const c of validCalls) {
          const res = availableResults.get(c.toolCallId)
          if (!res) continue
          cleanMessages.push({
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: c.toolCallId,
                toolName: c.toolName,
                output: { type: 'text', value: res.content || '' },
              },
            ],
          })
        }
      } else {
        cleanMessages.push({ role: 'assistant', content: '(Interrupted)' })
      }

      i = j - 1
    }
  }

  return cleanMessages
}
