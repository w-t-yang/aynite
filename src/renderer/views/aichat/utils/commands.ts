import type React from 'react'
import type { ChatMessage } from '../../../../lib/types/chat'
import { genId } from './message'

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
    const output = [res.stdout, res.stderr].filter(Boolean).join('\n').trim() || '(No output)'
    const commandStr = `${name} ${params.join(' ')}`
    
    // Format command result into text parts to comply with SDK v6 schema
    const formattedText = `${text}\n\n> Command: ${commandStr}\n${output}`

    setMessages([
      ...messages,
      {
        id: genId(),
        role: 'user',
        parts: [{ type: 'text', text: formattedText }],
        createdAt: new Date(),
      },
    ])
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : String(e)
    const commandStr = `${name} ${params.join(' ')}`
    const formattedText = `${text}\n\n> Command: ${commandStr}\nError: ${errorMsg}`

    setMessages([
      ...messages,
      {
        id: genId(),
        role: 'user',
        parts: [{ type: 'text', text: formattedText }],
        createdAt: new Date(),
      },
    ])
  } finally {
    setLoading(false)
  }
  return true
}
