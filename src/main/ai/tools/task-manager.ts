/**
 * Task management tools: create, update, get tasks and propose plans.
 *
 * Operates on markdown files in the session directory.
 * Each session has its own task and plan files (timestamped).
 * The latest filenames are tracked in session metadata.json.
 */

import { jsonSchema } from '@ai-sdk/provider-utils'
import { TOOL_METADATA } from '../../../lib/constants/ai'
import {
  readJson,
  rename,
  secureReadText,
  writeJson,
  writeText,
} from '../../../lib/path'
import type { SessionMetadata } from '../../../lib/types/chat'

function getMetaPath(sessionDir: string): string {
  return `${sessionDir}/metadata.json`
}

async function readMeta(sessionDir: string): Promise<SessionMetadata | null> {
  try {
    return await readJson<SessionMetadata>(getMetaPath(sessionDir))
  } catch {
    return null
  }
}

async function updateMeta(
  sessionDir: string,
  updates: Partial<SessionMetadata>,
): Promise<void> {
  const existing = await readMeta(sessionDir)
  // createdAt should not be overwritten
  const merged = {
    ...(existing || {}),
    ...updates,
    updatedAt: new Date().toISOString(),
  }
  await writeJson(getMetaPath(sessionDir), merged)
}

export function createTaskManager(sessionDir: string, domains: string[]) {
  const metaDir = sessionDir

  return {
    create_task: {
      description: TOOL_METADATA.create_task.description,
      inputSchema: jsonSchema(TOOL_METADATA.create_task.inputSchema),
      execute: async ({ tasks }: { tasks: string[]; filename?: string }) => {
        const timestamp = Date.now()
        const filename = `tasks-${timestamp}.md`
        const taskPath = `${sessionDir}/${filename}`
        const content = tasks.map((t) => `- [ ] ${t}`).join('\n')
        await writeText(taskPath, content)
        await updateMeta(metaDir, { currentTaskFile: filename })
        return `Created task list at ${taskPath}`
      },
    },
    update_task: {
      description: TOOL_METADATA.update_task.description,
      inputSchema: jsonSchema(TOOL_METADATA.update_task.inputSchema),
      execute: async ({
        taskIndex,
        status,
      }: {
        taskIndex: number
        status: 'todo' | 'in_progress' | 'done'
        filename?: string
      }) => {
        const meta = await readMeta(metaDir)
        const taskFilename = meta?.currentTaskFile
        if (!taskFilename) {
          return 'No active task list. Create one with `create_task` first.'
        }
        const taskPath = `${sessionDir}/${taskFilename}`

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
          const allDone = totalTasks > 0 && doneTasks === totalTasks

          if (allDone) {
            // Rename task file to mark as done
            const doneTaskFile = taskFilename.replace(/\.md$/, '-done.md')
            await rename(taskPath, `${sessionDir}/${doneTaskFile}`)
            await updateMeta(metaDir, { currentTaskFile: doneTaskFile })

            // Also mark the plan as done if one exists
            const planFilename = (await readMeta(metaDir))?.currentPlanFile
            if (planFilename) {
              const planPath = `${sessionDir}/${planFilename}`
              const donePlanFile = planFilename.replace(/\.md$/, '-done.md')
              await rename(planPath, `${sessionDir}/${donePlanFile}`)
              await updateMeta(metaDir, { currentPlanFile: donePlanFile })
            }
          }

          return `Updated task ${taskIndex + 1} to ${status} (${doneTasks}/${totalTasks})${allDone ? '\nAll tasks completed! Task list and plan marked as done.' : ''}`
        } catch (e) {
          return `Error updating task: ${e instanceof Error ? e.message : String(e)}`
        }
      },
    },
    get_tasks: {
      description: TOOL_METADATA.get_tasks.description,
      inputSchema: jsonSchema(TOOL_METADATA.get_tasks.inputSchema),
      execute: async () => {
        const meta = await readMeta(metaDir)
        const taskFilename = meta?.currentTaskFile
        if (!taskFilename) {
          return 'No active task list. Create one with `create_task` first.'
        }
        return await secureReadText(`${sessionDir}/${taskFilename}`, domains)
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
        const timestamp = Date.now()
        const filename = `plan-${timestamp}.md`
        const planPath = `${sessionDir}/${filename}`

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
        await updateMeta(metaDir, { currentPlanFile: filename })
        return `Implementation plan proposed at ${planPath}. Please review the file and type "Approved" to proceed.`
      },
    },
  }
}
