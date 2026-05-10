import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { jsonSchema } from '@ai-sdk/provider-utils'
import { TOOL_METADATA } from '../../lib/constants/ai'
import { ERROR_MESSAGES } from '../../lib/constants/messages'
import {
  getAyniteDir,
  getWorkspaceMemoryPath,
  getWorkspaceTaskPath,
  secureEditFile,
  secureGetFileTree,
  secureGlobSearch,
  secureGrepSearch,
  secureListDir,
  secureReadText,
  secureWriteText,
  writeText,
} from '../../lib/path'
import { requestAiApproval } from '../window'
import { getWorkspacesList } from '../workspace/logic'

const execAsync = promisify(exec)

import type { ToolContext } from '../../lib/types/ai'

export type { ToolContext }

export function getToolsMetadata() {
  return Object.entries(TOOL_METADATA).map(([id, meta]) => ({
    id,
    ...meta,
  }))
}

export function createTools(context: ToolContext) {
  const domains = [...context.workspaceFolders, getAyniteDir()]
  const tools: any = {
    read_file: {
      description: TOOL_METADATA.read_file.description,
      inputSchema: jsonSchema(TOOL_METADATA.read_file.inputSchema),
      execute: async ({ path: filePath }: { path: string }) => {
        return await secureReadText(filePath, domains)
      },
    },
    write_file: {
      description: TOOL_METADATA.write_file.description,
      inputSchema: jsonSchema(TOOL_METADATA.write_file.inputSchema),
      execute: async ({
        path: filePath,
        content,
      }: {
        path: string
        content: string
      }) => {
        return await secureWriteText(filePath, content, domains)
      },
    },
    edit_file: {
      description: TOOL_METADATA.edit_file.description,
      inputSchema: jsonSchema(TOOL_METADATA.edit_file.inputSchema),
      execute: async ({
        path: filePath,
        targetContent,
        replacementContent,
      }: {
        path: string
        targetContent: string
        replacementContent: string
      }) => {
        return await secureEditFile(
          filePath,
          targetContent,
          replacementContent,
          domains,
        )
      },
    },
    list_files: {
      description: TOOL_METADATA.list_files.description,
      inputSchema: jsonSchema(TOOL_METADATA.list_files.inputSchema),
      execute: async ({ path: dirPath }: { path: string }) => {
        return await secureListDir(dirPath, domains)
      },
    },
    run_command: {
      description: TOOL_METADATA.run_command.description,
      inputSchema: jsonSchema(TOOL_METADATA.run_command.inputSchema),
      execute: async ({ command, cwd }: { command: string; cwd?: string }) => {
        const runCwd = cwd || context.workspaceFolders[0] || '.'

        const approved = await requestAiApproval({
          command,
          cwd: runCwd,
        })

        if (!approved) return ERROR_MESSAGES.COMMAND_REJECTED

        try {
          const { stdout, stderr } = await execAsync(command, { cwd: runCwd })
          let output = stdout
          if (stderr?.trim()) {
            output += `\n\nSTDERR:\n${stderr}`
          }

          try {
            const parsed = JSON.parse(stdout.trim())
            if (
              parsed &&
              typeof parsed === 'object' &&
              parsed.status === 'error'
            ) {
              throw new Error(output)
            }
          } catch (_jsonErr) {}

          return output
        } catch (e: unknown) {
          const cmdErr = e as {
            stdout?: string
            stderr?: string
            message?: string
          }
          return ERROR_MESSAGES.COMMAND_EXEC_ERROR(
            cmdErr.message || '',
            cmdErr.stdout || '',
            cmdErr.stderr || '',
          )
        }
      },
    },
    grep_search: {
      description: TOOL_METADATA.grep_search.description,
      inputSchema: jsonSchema(TOOL_METADATA.grep_search.inputSchema),
      execute: async ({
        pattern,
        folderPath,
      }: {
        pattern: string
        folderPath: string
      }) => {
        return await secureGrepSearch(folderPath, pattern, domains)
      },
    },
    read_url: {
      description: TOOL_METADATA.read_url.description,
      inputSchema: jsonSchema(TOOL_METADATA.read_url.inputSchema),
      execute: async ({ url }: { url: string }) => {
        try {
          const response = await fetch(url, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
            },
          })
          if (!response.ok)
            return ERROR_MESSAGES.URL_FETCH_ERROR(response.statusText)
          const text = await response.text()
          return text
            .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, '')
            .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, '')
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 10000)
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : String(e)
          return ERROR_MESSAGES.URL_GENERIC_ERROR(message)
        }
      },
    },
    glob_search: {
      description: TOOL_METADATA.glob_search.description,
      inputSchema: jsonSchema(TOOL_METADATA.glob_search.inputSchema),
      execute: async ({ pattern, cwd }: { pattern: string; cwd?: string }) => {
        return await secureGlobSearch(pattern, domains, cwd)
      },
    },
    create_task: {
      description: TOOL_METADATA.create_task.description,
      inputSchema: jsonSchema(TOOL_METADATA.create_task.inputSchema),
      execute: async ({
        tasks,
        filename,
      }: {
        tasks: string[]
        filename?: string
      }) => {
        const { active } = await getWorkspacesList()
        const taskPath = getWorkspaceTaskPath(active, filename)
        const content = tasks.map((t) => `- [ ] ${t}`).join('\n')
        await writeText(taskPath, content)
        return `Created task list at ${taskPath}`
      },
    },
    update_task: {
      description: TOOL_METADATA.update_task.description,
      inputSchema: jsonSchema(TOOL_METADATA.update_task.inputSchema),
      execute: async ({
        taskIndex,
        status,
        filename,
      }: {
        taskIndex: number
        status: 'todo' | 'in_progress' | 'done'
        filename?: string
      }) => {
        const { active } = await getWorkspacesList()
        const taskPath = getWorkspaceTaskPath(active, filename)
        try {
          const content = await secureReadText(taskPath, domains)
          if (content.startsWith('Error')) return content

          const lines = content.split('\n')
          if (taskIndex < 0 || taskIndex >= lines.length) {
            return `Error: Task index ${taskIndex} out of range (0-${lines.length - 1})`
          }

          const statusMap = {
            todo: '[ ]',
            in_progress: '[/]',
            done: '[x]',
          }

          lines[taskIndex] = lines[taskIndex].replace(
            /\[[ x/]?\]/,
            statusMap[status],
          )
          await writeText(taskPath, lines.join('\n'))
          return `Updated task ${taskIndex} to ${status}`
        } catch (e) {
          return `Error updating task: ${e instanceof Error ? e.message : String(e)}`
        }
      },
    },
    get_tasks: {
      description: TOOL_METADATA.get_tasks.description,
      inputSchema: jsonSchema(TOOL_METADATA.get_tasks.inputSchema),
      execute: async ({ filename }: { filename?: string }) => {
        const { active } = await getWorkspacesList()
        const taskPath = getWorkspaceTaskPath(active, filename)
        return await secureReadText(taskPath, domains)
      },
    },
    propose_plan: {
      description: TOOL_METADATA.propose_plan.description,
      inputSchema: jsonSchema(TOOL_METADATA.propose_plan.inputSchema),
      execute: async ({
        problemStatement,
        investigationResults,
        proposedArchitecture,
        implementationSteps,
        verificationPlan,
        openQuestions,
      }: {
        problemStatement: string
        investigationResults: string
        proposedArchitecture: string
        implementationSteps: string[]
        verificationPlan: string
        openQuestions?: string[]
      }) => {
        const { active } = await getWorkspacesList()
        const planPath = getWorkspaceTaskPath(active, 'implementation_plan.md')

        const content = [
          '# Implementation Plan',
          '',
          '## 1. Problem Statement',
          problemStatement,
          '',
          '## 2. Investigation Results',
          investigationResults,
          '',
          '## 3. Proposed Architecture & Trade-offs',
          proposedArchitecture,
          '',
          '## 4. Implementation Steps',
          implementationSteps.map((s, i) => `${i + 1}. ${s}`).join('\n'),
          '',
          '## 5. Verification Plan',
          verificationPlan,
          '',
          '## 6. Open Questions & Assumptions',
          openQuestions?.length
            ? openQuestions.map((q) => `- ${q}`).join('\n')
            : 'None',
        ].join('\n')

        await writeText(planPath, content)
        return `Implementation plan proposed at ${planPath}. Please review the file and type "Approved" to proceed.`
      },
    },
    initialize_memory: {
      description: TOOL_METADATA.initialize_memory.description,
      inputSchema: jsonSchema(TOOL_METADATA.initialize_memory.inputSchema),
      execute: async () => {
        const { active } = await getWorkspacesList()
        const memoryPath = getWorkspaceMemoryPath(active)

        // Gather intelligence
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
            readmeInfo = content.slice(0, 1000) // First 1000 chars
          }
        }

        const tree = await secureGetFileTree(domains[0], domains, 2)

        const content = [
          '# Project Memory',
          '',
          '## 🛠️ Tech Stack',
          pkgInfo,
          '',
          '## 📂 Project Structure (Summary)',
          `\`\`\`\n${tree}\n\`\`\``,
          '',
          '## 📖 README Snippet',
          readmeInfo || 'No README found.',
          '',
          '## 🏗️ Architectural Decisions & Patterns',
          '- (No patterns recorded yet)',
          '',
          '## 🧪 Naming Conventions',
          '- (No conventions recorded yet)',
        ].join('\n')

        await writeText(memoryPath, content)
        return `Project memory initialized at ${memoryPath}. You should now update it with specific project secrets or conventions.`
      },
    },
    update_memory: {
      description: TOOL_METADATA.update_memory.description,
      inputSchema: jsonSchema(TOOL_METADATA.update_memory.inputSchema),
      execute: async ({ update }: { update: string }) => {
        const { active } = await getWorkspacesList()
        const memoryPath = getWorkspaceMemoryPath(active)
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
        const { active } = await getWorkspacesList()
        const memoryPath = getWorkspaceMemoryPath(active)
        const content = await secureReadText(memoryPath, domains)
        if (content.startsWith('Error')) {
          return 'No project memory found. You can initialize it using "initialize_memory".'
        }
        return content
      },
    },
    get_file_tree: {
      description: TOOL_METADATA.get_file_tree.description,
      inputSchema: jsonSchema(TOOL_METADATA.get_file_tree.inputSchema),
      execute: async ({
        path: dirPath,
        depth = 10,
      }: {
        path?: string
        depth?: number
      }) => {
        if (dirPath) {
          return await secureGetFileTree(dirPath, domains, depth)
        } else {
          let fullOutput = ''
          for (const folder of context.workspaceFolders) {
            fullOutput += `Workspace Folder: ${folder}\n`
            fullOutput += await secureGetFileTree(folder, domains, depth)
            fullOutput += '\n'
          }
          return fullOutput || ERROR_MESSAGES.WORKSPACE_EMPTY
        }
      },
    },
    get_workspace_info: {
      description: TOOL_METADATA.get_workspace_info.description,
      inputSchema: jsonSchema(TOOL_METADATA.get_workspace_info.inputSchema),
      execute: async () => {
        return {
          workspaceFolders: context.workspaceFolders,
          configDir: getAyniteDir(),
          activeFile: context.activeFile || null,
        }
      },
    },
  }

  return tools
}
