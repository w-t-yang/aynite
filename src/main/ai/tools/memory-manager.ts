/**
 * Memory management tools: read and update session memory.
 *
 * Operates on memory.md in the session directory
 * (next to messages.json and metadata.json).
 */

import { jsonSchema } from '@ai-sdk/provider-utils'
import { TOOL_METADATA } from '../../../lib/constants/ai'
import { secureReadText, writeText } from '../../../lib/path'

export function createMemoryManager(sessionDir: string, domains: string[]) {
  const memoryPath = `${sessionDir}/memory.md`

  return {
    update_memory: {
      description: TOOL_METADATA.update_memory.description,
      inputSchema: jsonSchema(TOOL_METADATA.update_memory.inputSchema),
      execute: async ({ update }: { update: string }) => {
        try {
          const current = await secureReadText(memoryPath, domains)
          const content = current.startsWith('Error')
            ? `# Session Memory\n\n${update}`
            : `${current}\n\n### Update (${new Date().toLocaleDateString()})\n${update}`

          await writeText(memoryPath, content)
          return `Session memory updated at ${memoryPath}`
        } catch (e) {
          return `Error updating memory: ${e instanceof Error ? e.message : String(e)}`
        }
      },
    },
    read_memory: {
      description: TOOL_METADATA.read_memory.description,
      inputSchema: jsonSchema(TOOL_METADATA.read_memory.inputSchema),
      execute: async () => {
        const content = await secureReadText(memoryPath, domains)
        if (content.startsWith('Error')) {
          return 'No session memory found. Use `update_memory` to record decisions and context.'
        }
        return content
      },
    },
  }
}
