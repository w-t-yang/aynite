import fs from 'node:fs/promises'
import { ipcMain } from 'electron'
import { SpellChannels } from '../../lib/constants/ipc-channels'
import { joinPaths } from '../../lib/path'
import { execInUserShell } from '../system/logic'
import { showOpenDialog } from '../window'
import { listAvailableCommands, restoreDefaultCommands } from './commands'
import { listAvailableSkills, restoreDefaultSkills } from './skills'

interface CommandRunPayload {
  command: string
  cwd?: string
}

interface DirectCommandRunPayload {
  commandPath: string
  params: string[]
  currentFile?: string
}

export function setupSpellsIpc() {
  const handleAddFolder = async () => {
    const { canceled, filePaths } = await showOpenDialog({
      properties: ['openDirectory'],
    })
    if (canceled || filePaths.length === 0) return null
    return filePaths[0]
  }

  ipcMain.handle(SpellChannels.SKILL_ADD_FOLDER, handleAddFolder)

  ipcMain.handle(SpellChannels.SKILL_RESTORE, async () => {
    return await restoreDefaultSkills()
  })

  ipcMain.handle(SpellChannels.COMMAND_ADD_FOLDER, handleAddFolder)

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
      const { stdout, stderr } = await execInUserShell(command, {
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

      const { stdout, stderr } = await execInUserShell(fullCmd, {
        cwd: commandPath,
        env,
      })
      return { stdout, stderr }
    },
  )
}

export {
  getCommandsConfig,
  listAvailableCommands,
  restoreCommand,
  restoreDefaultCommands,
  saveCommandsConfig,
} from './commands'
export {
  findFilesRecursively,
  getBundledResourcesPath,
  notifyError,
  reportedErrors,
} from './common'
export {
  getSkillsConfig,
  listAvailableSkills,
  restoreDefaultSkills,
  restoreSkill,
  saveSkillsConfig,
} from './skills'
export { restoreSpell } from './spell-installer'
