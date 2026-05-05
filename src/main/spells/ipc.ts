import { exec } from 'node:child_process'
import fs from 'node:fs/promises'
import { promisify } from 'node:util'
import { type BrowserWindow, dialog, ipcMain } from 'electron'
import { joinPaths } from '../../lib/path'
import { listAvailableCommands, restoreDefaultCommands } from './commands'
import { listAvailableSkills, restoreDefaultSkills } from './skills'

const execAsync = promisify(exec)

import { SpellChannels } from '../../lib/constants/ipc-channels'

export interface CommandRunPayload {
  command: string
  cwd?: string
}

export interface DirectCommandRunPayload {
  commandPath: string
  params: string[]
  currentFile?: string
}

export interface CommandResult {
  stdout: string
  stderr: string
}

export function setupSpellsIpc(mainWindow: BrowserWindow) {
  ipcMain.handle(SpellChannels.SKILL_ADD_FOLDER, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    })
    if (canceled || filePaths.length === 0) return null
    return filePaths[0]
  })

  ipcMain.handle(SpellChannels.SKILL_RESTORE, async () => {
    return await restoreDefaultSkills()
  })

  ipcMain.handle(SpellChannels.COMMAND_ADD_FOLDER, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    })
    if (canceled || filePaths.length === 0) return null
    return filePaths[0]
  })

  ipcMain.handle(SpellChannels.COMMAND_RESTORE, async () => {
    return await restoreDefaultCommands()
  })

  ipcMain.handle(SpellChannels.SKILL_LIST, async () => {
    return await listAvailableSkills()
  })

  ipcMain.handle(SpellChannels.COMMAND_LIST, async () => {
    return await listAvailableCommands()
  })

  ipcMain.handle(
    SpellChannels.COMMAND_RUN,
    async (_event, { command, cwd }: CommandRunPayload) => {
      const { stdout, stderr } = await execAsync(command, {
        cwd: cwd || process.cwd(),
      })
      return { stdout, stderr }
    },
  )

  ipcMain.handle(
    SpellChannels.COMMAND_RUN_DIRECT,
    async (
      _event,
      { commandPath, params, currentFile }: DirectCommandRunPayload,
    ) => {
      const runShPath = joinPaths(commandPath, 'run.sh')
      if (process.platform !== 'win32') {
        try {
          await fs.chmod(runShPath, 0o755)
        } catch (e) {
          console.error('Failed to set chmod on run.sh', e)
        }
      }

      const env = {
        ...process.env,
        AYNITE_CURRENT_FILE: currentFile || '',
      }

      const resolvedParams = params.map((p) => {
        return p.replace(/@(?:file|skill|cmd)\[.*?\]\((.*?)\)/g, '$1')
      })

      const quotedParams = resolvedParams
        .map((p) => `"${p.replace(/"/g, '\\"')}"`)
        .join(' ')
      const fullCmd =
        process.platform === 'win32'
          ? `sh "${runShPath}" ${quotedParams}`
          : `"${runShPath}" ${quotedParams}`

      const { stdout, stderr } = await execAsync(fullCmd, {
        cwd: commandPath,
        env,
      })
      return { stdout, stderr }
    },
  )
}
