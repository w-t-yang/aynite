import type { UIMessage } from 'ai'
import { createMessage } from '../../../../lib/types/chat'
import { aiMutations } from '../../../bridge/ai'

export async function executeCommandOnly(
  text: string,
  activeTabPath: string,
  messages: UIMessage[],
  setMessages: (msgs: UIMessage[]) => void,
  setLoading: (loading: boolean) => void,
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
    const res = await aiMutations.runDirectCommand({
      commandPath: path,
      params,
      currentFile: activeTabPath,
    })
    const output =
      [res.stdout, res.stderr].filter(Boolean).join('\n').trim() ||
      '(No output)'
    const _commandStr = `${name} ${params.join(' ')}`

    // Format command result into text parts
    const formattedText = `${text}\n\n${output}`

    setMessages([
      ...messages,
      createMessage('user', [{ type: 'text', text: formattedText }]),
    ])
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : String(e)
    const formattedText = `${text}\n\nError: ${errorMsg}`

    setMessages([
      ...messages,
      createMessage('user', [{ type: 'text', text: formattedText }]),
    ])
  } finally {
    setLoading(false)
  }
  return true
}
