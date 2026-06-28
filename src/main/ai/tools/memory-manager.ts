/**
 * Memory management tools: read and update project memory.
 *
 * Operates on memory.md in the workspace artifacts directory.
 */

import { jsonSchema } from '@ai-sdk/provider-utils'
import { TOOL_METADATA } from '../../../lib/constants/ai'
import {
  getWorkspaceMemoryPath,
  secureReadText,
  writeText,
} from '../../../lib/path'

export function createMemoryManager(workspaceName: string, domains: string[]) {
  return {
    update_memory: {
      description: TOOL_METADATA.update_memory.description,
      inputSchema: jsonSchema(TOOL_METADATA.update_memory.inputSchema),
      execute: async ({ update }: { update: string }) => {
        const memoryPath = getWorkspaceMemoryPath(workspaceName)
        try {
          const current = await secureReadText(memoryPath, domains)
          const content = current.startsWith('Error')
            ? `# Project Memory\n\n${update}`
            : `${current}\n\n### Update (${new Date().toLocaleDateString()})\n${update}`

          await writeText(memoryPath, content)
          return `Project memory updated at ${memoryPath}`
        } catch (e) {
          return `Error updating memory: ${e instanceof Error ? e.message : String(e)}`
        }
      },
    },
    read_memory: {
      description: TOOL_METADATA.read_memory.description,
      inputSchema: jsonSchema(TOOL_METADATA.read_memory.inputSchema),
      execute: async () => {
        const memoryPath = getWorkspaceMemoryPath(workspaceName)
        const content = await secureReadText(memoryPath, domains)
        if (content.startsWith('Error')) {
          return 'No project memory found. You can create one manually or ask the user to set it up.'
        }
        return content
      },
    },
  }
}
