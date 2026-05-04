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

export function setupSpellsIpc(mainWindow: BrowserWindow) {
  ipcMain.handle('aynite:spell-skill-add-folder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    if (canceled || filePaths.length === 0) return null;
    return filePaths[0];
  });

  ipcMain.handle('aynite:spell-skill-restore-default', async () => {
    return await restoreDefaultSkills();
  });

  ipcMain.handle('aynite:spell-command-add-folder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    if (canceled || filePaths.length === 0) return null;
    return filePaths[0];
  });

  ipcMain.handle('aynite:spell-command-restore-default', async () => {
    return await restoreDefaultCommands();
  });

  ipcMain.handle('aynite:spell-skill-list', async () => {
    return await listAvailableSkills();
  });

  ipcMain.handle('aynite:spell-command-list', async () => {
    return await listAvailableCommands();
  });

  ipcMain.handle('aynite:spell-command-run', async (event, { command, cwd }: { command: string, cwd?: string }) => {
    const { stdout, stderr } = await execAsync(command, { cwd: cwd || process.cwd() });
    return { stdout, stderr };
  });

  ipcMain.handle('aynite:spell-command-run-direct', async (event, { commandPath, params, currentFile }: { commandPath: string, params: string[], currentFile?: string }) => {
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
