/**
 * Shell command execution tool.
 *
 * Spawns a user shell, streams output back to the renderer in real-time,
 * and handles approval requests before executing.
 */
import { spawn } from 'node:child_process'
import { jsonSchema } from '@ai-sdk/provider-utils'
import { TOOL_METADATA } from '../../../lib/constants/ai'
import { ERROR_MESSAGES } from '../../../lib/constants/messages'
import type { ToolContext } from '../../../lib/types/ai'
import { getShellConfig } from '../../system/logic'
import { requestAiApproval } from '../../window'

export function createRunCommand(
  workspaceFolders: string[],
  context: ToolContext,
) {
  return {
    run_command: {
      description: TOOL_METADATA.run_command.description,
      inputSchema: jsonSchema(TOOL_METADATA.run_command.inputSchema),
      execute: async ({ command, cwd }: { command: string; cwd?: string }) => {
        const runCwd = cwd || workspaceFolders[0] || '.'

        const approved = await requestAiApproval({
          command,
          cwd: runCwd,
        })

        if (!approved) return ERROR_MESSAGES.COMMAND_REJECTED

        try {
          return await new Promise<string>((resolve, reject) => {
            const config = getShellConfig()
            const shell = config.shell
            const shellArgs = [...config.args, command]

            const child = spawn(shell, shellArgs, {
              cwd: runCwd,
              stdio: ['pipe', 'pipe', 'pipe'],
              env: { ...process.env },
            })

            let stdout = ''
            let stderr = ''

            child.stdout?.on('data', (chunk: Buffer) => {
              const text = chunk.toString()
              stdout += text
              context.onCommandProgress?.(text)
            })

            child.stderr?.on('data', (chunk: Buffer) => {
              const text = chunk.toString()
              stderr += text
              context.onCommandProgress?.(text)
            })

            child.on('error', (err) => {
              reject(err)
            })

            child.on('close', (code) => {
              let output = stdout || ''
              if (stderr?.trim()) {
                output += `\n\nSTDERR:\n${stderr}`
              }

              if (code !== 0) {
                resolve(
                  ERROR_MESSAGES.COMMAND_EXEC_ERROR(
                    `Exit code: ${code}`,
                    stdout || '',
                    stderr || '',
                  ),
                )
                return
              }

              try {
                const parsed = JSON.parse(stdout.trim())
                if (
                  parsed &&
                  typeof parsed === 'object' &&
                  parsed.status === 'error'
                ) {
                  resolve(
                    ERROR_MESSAGES.COMMAND_EXEC_ERROR(
                      output,
                      stdout || '',
                      stderr || '',
                    ),
                  )
                  return
                }
              } catch (_jsonErr) {}

              resolve(output)
            })
          })
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
  }
}
