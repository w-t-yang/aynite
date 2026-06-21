/**
 * get_messages tool — reads chat history from bot message logs.
 *
 * This tool is ONLY available in messenger/bot sessions. It reads from the
 * per-chat date-based message files at:
 *   ~/.aynite/bots/<messengerId>/<chatName>/<date>.json
 *
 * Fetches the most recent N messages, scanning backwards across dates
 * to ensure enough context is collected. This handles edge cases like:
 * - Conversations crossing midnight (messages at 23:59 followed by 00:01)
 * - Users returning the next day and referencing yesterday's discussion
 *
 * The AI agent should use this sparingly — only when it needs context from
 * earlier conversation that isn't captured in the current session window
 * (e.g. group chat discussions before being asked to take action).
 */

import { getBotChatDatePath, getBotChatDir } from '../../../lib/path'
import { readJson } from '../../../lib/path/operations'

interface GetMessagesParams {
  count?: number
  since?: string
}

interface MessageEntry {
  role: string
  sender: string
  text: string
  timestamp: string
}

/**
 * Create the get_messages tool for a specific bot channel.
 */
export function createGetMessagesTool(messengerId: string, chatName: string) {
  return {
    description:
      'Fetch recent messages from the chat history. Use this when you need to understand context from earlier conversation, especially in group chats where users discuss topics before asking you to take action (e.g. summarizing notes, creating todos). Only messages from the current channel are accessible. After reading history, you MUST ask the user to confirm whether you understood the context correctly.',
    parameters: {
      type: 'object',
      properties: {
        count: {
          type: 'number',
          description:
            'Number of recent messages to fetch (default 10, max 50). The tool scans backwards across dates to collect enough context.',
        },
        since: {
          type: 'string',
          description:
            'Optional ISO date string to start from (e.g. "2026-06-20"). If omitted, starts from today and scans backwards.',
        },
      },
    },
    execute: async (params: GetMessagesParams) => {
      const targetCount = Math.min(params.count ?? 10, 50)
      const startDate = params.since || new Date().toISOString().split('T')[0]

      try {
        const { readdirSync, existsSync } = await import('node:fs')
        const chatDir = getBotChatDir(messengerId, chatName)
        if (!existsSync(chatDir)) {
          return 'No messages found for this channel.'
        }

        // Collect all date files (sorted ascending for chronological order)
        const dateFiles = readdirSync(chatDir)
          .filter(
            (f) =>
              f.endsWith('.json') &&
              !f.startsWith('.') &&
              !f.startsWith('session'),
          )
          .map((f) => f.replace('.json', ''))
          .sort()

        if (dateFiles.length === 0) {
          return 'No messages found for this channel.'
        }

        // Find the index of the start date (or the latest date if not found)
        const startIdx = dateFiles.indexOf(startDate)
        const latestIdx = dateFiles.length - 1
        const scanStartIdx = startIdx >= 0 ? startIdx : latestIdx

        // Scan backwards from start date, collecting messages until we have enough
        const collected: MessageEntry[] = []
        for (
          let i = scanStartIdx;
          i >= 0 && collected.length < targetCount;
          i--
        ) {
          const path = getBotChatDatePath(messengerId, chatName, dateFiles[i])
          const entries = await readJson<MessageEntry[]>(path, [])
          // Prepend so chronological order is maintained
          collected.unshift(...entries)
        }

        // Take only the most recent N messages (from the end)
        const sliced = collected.slice(-targetCount)
        return formatMessages(sliced, targetCount, collected.length)
      } catch (err) {
        return `Error reading messages: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  }
}

function formatMessages(
  messages: MessageEntry[],
  targetCount: number,
  totalAvailable: number,
): string {
  if (messages.length === 0) return 'No messages found.'

  const header =
    messages.length < totalAvailable
      ? `Showing ${messages.length} of ${totalAvailable} available messages (requested ${targetCount}):\n\n`
      : `Showing ${messages.length} messages:\n\n`

  const body = messages
    .map((m) => {
      const time = m.timestamp
        ? new Date(m.timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
          })
        : ''
      const date = m.timestamp
        ? new Date(m.timestamp).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })
        : ''
      return `[${date} ${time}] ${m.sender || m.role}: ${m.text}`
    })
    .join('\n')

  return header + body
}
