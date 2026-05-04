import { ipcMain, dialog, BrowserWindow } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import {
  restoreDefaultSkills,
  listAvailableSkills
} from './skills';
import {
  restoreDefaultCommands,
  listAvailableCommands
} from './commands';
import { joinPaths } from '../../lib/path';

const execAsync = promisify(exec);

// ─── Channel constants ────────────────────────────────────────────────────
export const SpellChannels = {
  SKILL_ADD_FOLDER: 'aynite:spell-skill-add-folder',
  SKILL_RESTORE: 'aynite:spell-skill-restore-default',
  COMMAND_ADD_FOLDER: 'aynite:spell-command-add-folder',
  COMMAND_RESTORE: 'aynite:spell-command-restore-default',
  SKILL_LIST: 'aynite:spell-skill-list',
  COMMAND_LIST: 'aynite:spell-command-list',
  COMMAND_RUN: 'aynite:spell-command-run',
  COMMAND_RUN_DIRECT: 'aynite:spell-command-run-direct',
} as const;

export interface CommandRunPayload {
  command: string;
  cwd?: string;
}

export interface DirectCommandRunPayload {
  commandPath: string;
  params: string[];
  currentFile?: string;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
}

export function setupSpellsIpc(mainWindow: BrowserWindow) {
  ipcMain.handle(SpellChannels.SKILL_ADD_FOLDER, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    if (canceled || filePaths.length === 0) return null;
    return filePaths[0];
  });

  ipcMain.handle(SpellChannels.SKILL_RESTORE, async () => {
    return await restoreDefaultSkills();
  });

  ipcMain.handle(SpellChannels.COMMAND_ADD_FOLDER, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    if (canceled || filePaths.length === 0) return null;
    return filePaths[0];
  });

  ipcMain.handle(SpellChannels.COMMAND_RESTORE, async () => {
    return await restoreDefaultCommands();
  });

  ipcMain.handle(SpellChannels.SKILL_LIST, async () => {
    return await listAvailableSkills();
  });

  ipcMain.handle(SpellChannels.COMMAND_LIST, async () => {
    return await listAvailableCommands();
  });

  ipcMain.handle(SpellChannels.COMMAND_RUN, async (_event, { command, cwd }: CommandRunPayload) => {
    const { stdout, stderr } = await execAsync(command, { cwd: cwd || process.cwd() });
    return { stdout, stderr };
  });

  ipcMain.handle(SpellChannels.COMMAND_RUN_DIRECT, async (_event, { commandPath, params, currentFile }: DirectCommandRunPayload) => {
    const runShPath = joinPaths(commandPath, 'run.sh');
    if (process.platform !== 'win32') {
      try {
        await fs.chmod(runShPath, 0o755);
      } catch (e) {
        console.error('Failed to set chmod on run.sh', e);
      }
    }

    const env = {
      ...process.env,
      AYNITE_CURRENT_FILE: currentFile || ''
    };

    const resolvedParams = params.map(p => {
      return p.replace(/@(?:file|skill|cmd)\[.*?\]\((.*?)\)/g, '$1');
    });

    const quotedParams = resolvedParams.map(p => `"${p.replace(/"/g, '\\"')}"`).join(' ');
    const fullCmd = process.platform === 'win32' ? `sh "${runShPath}" ${quotedParams}` : `"${runShPath}" ${quotedParams}`;

    const { stdout, stderr } = await execAsync(fullCmd, {
      cwd: commandPath,
      env
    });
    return { stdout, stderr };
  });
}
