import type { UIMessage } from 'ai'
import type React from 'react'
import { genId } from './message'

export async function executeCommandOnly(
  text: string,
  activeTabPath: string,
  messages: UIMessage[],
  setMessages: React.Dispatch<React.SetStateAction<UIMessage[]>>,
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
    const output =
      [res.stdout, res.stderr].filter(Boolean).join('\n').trim() ||
      '(No output)'
    const _commandStr = `${name} ${params.join(' ')}`

    // Format command result into text parts
    const formattedText = `${text}\n\n${output}`

    setMessages([
      ...messages,
      {
        id: genId(),
        role: 'user',
        parts: [{ type: 'text', text: formattedText }],
      },
    ])
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : String(e)
    const formattedText = `${text}\n\nError: ${errorMsg}`

    setMessages([
      ...messages,
      {
        id: genId(),
        role: 'user',
        parts: [{ type: 'text', text: formattedText }],
      },
    ])
  } finally {
    setLoading(false)
  }
  return true
}
