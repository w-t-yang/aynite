/**
 * Memory management tools: initialize, read, update project memory.
 *
 * Operates on memory.md in the workspace artifacts directory.
 * initialize_memory gathers project intelligence (package.json, README, file tree).
 */

import { jsonSchema } from '@ai-sdk/provider-utils'
import { TOOL_METADATA } from '../../../lib/constants/ai'
import {
  getWorkspaceMemoryPath,
  secureGetFileTree,
  secureReadText,
  writeText,
} from '../../../lib/path'

export function createMemoryManager(workspaceName: string, domains: string[]) {
  return {
    initialize_memory: {
      description: TOOL_METADATA.initialize_memory.description,
      inputSchema: jsonSchema(TOOL_METADATA.initialize_memory.inputSchema),
      execute: async () => {
        const memoryPath = getWorkspaceMemoryPath(workspaceName)

        const pkgPath = domains[0] ? `${domains[0]}/package.json` : null
        const readmePath = domains[0] ? `${domains[0]}/README.md` : null

        let pkgInfo = 'Unknown'
        if (pkgPath) {
          const content = await secureReadText(pkgPath, domains)
          if (!content.startsWith('Error')) {
            try {
              const pkg = JSON.parse(content)
              pkgInfo = `Project: ${pkg.name}\nVersion: ${pkg.version}\nDependencies: ${Object.keys(
                pkg.dependencies || {},
              ).join(', ')}`
            } catch (_e) {
              pkgInfo = 'Invalid package.json'
            }
          }
        }

        let readmeInfo = ''
        if (readmePath) {
          const content = await secureReadText(readmePath, domains)
          if (!content.startsWith('Error')) {
            readmeInfo = content.slice(0, 1000)
          }
        }

        const tree = await secureGetFileTree(domains[0], domains, 2)

        const content = [
          '# Project Memory',
          '',
          '## 🎯 Overview',
          readmeInfo || 'No summary available yet.',
          '',
          '## 📂 Structure',
          `\`\`\`\n${tree}\n\`\`\``,
          '',
          '## 📜 Rules & Conventions',
          pkgInfo !== 'Unknown' ? `- Tech Stack: ${pkgInfo}` : '',
          '- (Record styles, patterns, or project rules here)',
          '',
          '## 💡 Key Decisions & Context',
          '- (Record important architectural or narrative decisions here)',
        ]
          .filter(Boolean)
          .join('\n')

        await writeText(memoryPath, content)
        return `Project memory initialized at ${memoryPath}. You should now update it with specific project secrets or conventions.`
      },
    },
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
          return 'No project memory found. You can initialize it using "initialize_memory".'
        }
        return content
      },
    },
  }
}
