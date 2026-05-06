import type { ChatMessage } from '../../../../lib/constants/chat'

export function genId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/** Append text to the last assistant message, or create a new one. */
export function appendToAssistant(
  prev: ChatMessage[],
  text: string,
): ChatMessage[] {
  const last = prev[prev.length - 1]
  if (last && last.role === 'assistant') {
    const existingContent = typeof last.content === 'string' ? last.content : ''
    return [
      ...prev.slice(0, -1),
      {
        id: last.id,
        role: 'assistant',
        content: existingContent + text,
        createdAt: last.createdAt,
      },
    ]
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
    const output = content || '(No output)'
    setMessages([
      ...messages,
      { id: genId(), role: 'user', content: text, createdAt: Date.now() },
      {
        id: genId(),
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: '',
            toolName: name,
            output,
          },
        ],
        createdAt: Date.now(),
      },
    ])
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : String(e)
    setMessages([
      ...messages,
      { id: genId(), role: 'user', content: text, createdAt: Date.now() },
      {
        id: genId(),
        role: 'assistant',
        content: `**Execution Error**: ${errorMsg}`,
        createdAt: Date.now(),
      },
    ])
  } finally {
    setLoading(false)
  }
  return true
}
