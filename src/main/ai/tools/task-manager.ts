/**
 * Task management tools: create, update, get tasks and propose plans.
 *
 * Operates on markdown files in the workspace artifacts directory.
 */

import { jsonSchema } from '@ai-sdk/provider-utils'
import { TOOL_METADATA } from '../../../lib/constants/ai'
import {
  getWorkspaceTaskPath,
  secureReadText,
  writeText,
} from '../../../lib/path'

export function createTaskManager(workspaceName: string, domains: string[]) {
  return {
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
        const taskPath = getWorkspaceTaskPath(workspaceName, filename)
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
        const taskPath = getWorkspaceTaskPath(workspaceName, filename)
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

          const totalTasks = lines.filter((l) =>
            /^\s*-\s*\[[ x/]?\]/.test(l),
          ).length
          const doneTasks = lines.filter((l) => /^\s*-\s*\[x\]/.test(l)).length

          return `Updated task ${taskIndex + 1} to ${status} (${doneTasks}/${totalTasks})`
        } catch (e) {
          return `Error updating task: ${e instanceof Error ? e.message : String(e)}`
        }
      },
    },
    get_tasks: {
      description: TOOL_METADATA.get_tasks.description,
      inputSchema: jsonSchema(TOOL_METADATA.get_tasks.inputSchema),
      execute: async ({ filename }: { filename?: string }) => {
        const taskPath = getWorkspaceTaskPath(workspaceName, filename)
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
        const planPath = getWorkspaceTaskPath(
          workspaceName,
          'implementation_plan.md',
        )

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
  }
}
