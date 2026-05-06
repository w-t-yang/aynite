import type { AgentStepEvent, ChatMessage } from '../../lib/types'

export function normalizeAndHealMessages(msgs: any[]): ChatMessage[] {
  const normalized = msgs.map((m: any) => ({
    ...m,
    id: m.id || Math.random().toString(36).slice(2, 11),
    content: m.content || m.text || '',
  }))

  const healed: ChatMessage[] = []
  for (let i = 0; i < normalized.length; i++) {
    const m = normalized[i]
    healed.push(m)

    if (m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0) {
      const existingResultIds = new Set<string>()
      let j = i + 1
      while (j < normalized.length && normalized[j].role === 'tool') {
        if (normalized[j].tool_call_id) {
          existingResultIds.add(normalized[j].tool_call_id)
        }
        j++
      }

      for (const call of m.tool_calls) {
        const callId = call.toolCallId || call.id
        if (callId && !existingResultIds.has(callId)) {
          healed.push({
            id: Math.random().toString(36).slice(2, 11),
            role: 'tool',
            content: 'Task interrupted before completion.',
            tool_call_id: callId,
            name: call.toolName || call.function?.name,
          })
        }
      }
    }
  }
  return healed
}

export function genId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function appendToAssistant(
  prev: ChatMessage[],
  update: Partial<ChatMessage>,
): ChatMessage[] {
  const last = prev[prev.length - 1]
  if (last && last.role === 'assistant') {
    return [...prev.slice(0, -1), { ...last, ...update }]
  }
  return [
    ...prev,
    { id: genId(), role: 'assistant', content: '', ...update },
  ]
}

export async function executeCommandOnly(
  text: string,
  activeTabPath: string,
  messages: ChatMessage[],
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  setLoading: React.Dispatch<React.SetStateAction<boolean>>,
): Promise<boolean> {
  const firstCmdMatch = text.trim().match(/^>cmd\[(.*?)\]\((.*?)\)/)
  if (!firstCmdMatch) return false

  const [fullMatch, name, path] = firstCmdMatch
  const remainingText = text.trim().slice(fullMatch.length).trim()
  const fileMentionRegex = /@(?:file|dir)\[(.*?)\]\((.*?)\)/g
  const skillMentionRegex = /\/skill\[(.*?)\]\((.*?)\)/g
  const commandMentionRegex = />cmd\[(.*?)\]\((.*?)\)/g

  const params = remainingText
    .replace(fileMentionRegex, '$2')
    .replace(skillMentionRegex, '$2')
    .replace(commandMentionRegex, '$2')
    .split(/\s+/)
    .filter(Boolean)

  setLoading(true)
  try {
    const res = await window.aynite.runDirectCommand({
      commandPath: path,
      params,
      currentFile: activeTabPath,
    })
    const content = [res.stdout, res.stderr].filter(Boolean).join('\n').trim()
    setMessages([
      ...messages,
      { id: genId(), role: 'user', content: text },
      {
        id: genId(),
        role: 'tool',
        name,
        content: content || '(No output)',
      },
    ])
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : String(e)
    setMessages([
      ...messages,
      { id: genId(), role: 'user', content: text },
      {
        id: genId(),
        role: 'assistant',
        content: `❌ **Execution Error**: ${errorMsg}`,
      },
    ])
  } finally {
    setLoading(false)
  }
  return true
}
