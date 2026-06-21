/**
 * notify_user tool — sends a message back to the user via the messenger bot.
 *
 * This tool is ONLY available in messenger/bot sessions. It allows the AI
 * to send a notification/reply to the user when it cannot answer immediately.
 *
 * Use cases:
 * - The AI needs time to run commands or tools before giving a full answer
 * - The AI needs to research and will get back to the user later
 * - The AI wants to acknowledge a request before starting long work
 *
 * The AI should reply directly whenever possible, and only use this tool
 * when it needs to inform the user about something (e.g. "Working on it,
 * I'll get back to you").
 */

import { jsonSchema } from '@ai-sdk/provider-utils'
import type { MessengerContext } from '../../messengers/shared'

interface NotifyUserParams {
  message: string
}

/**
 * Create the notify_user tool for a messenger context.
 * Accepts a MessengerContext to send replies back through.
 */
export function createNotifyUserTool(ctx: MessengerContext) {
  return {
    description:
      'Send a message to the user in the current chat. Use this when you cannot answer immediately and need time to work (e.g. running commands, researching). Reply directly when you can answer right away; use this tool only to acknowledge requests that require longer processing.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The message to send to the user',
        },
      },
      required: ['message'],
    }),
    execute: async (params: NotifyUserParams) => {
      await ctx.reply(params.message)
      return `Notification sent: "${params.message}"`
    },
  }
}
