import { ipcMain, dialog, BrowserWindow } from 'electron';
import {
  getWorkspacesList,
  createWorkspace,
  switchWorkspace,
  addWorkspaceFolder,
  getWorkspaceFolders,
  getWorkspaceState,
  saveWorkspaceState,
  reorderWorkspaceFolders,
  removeWorkspaceFolder
} from './logic';
import { getIgnorePatterns } from '../config';
import { exists, readdir, getAbsolutePath } from '../../lib/path';
import { WorkspaceTab } from '../../lib/types/workspace';
import { setupWatcher } from '../file';
import { WorkspaceConfig } from '../../lib/constants/types';
import { WorkspaceChannels } from '../../lib/constants/ipc-channels';






export interface WorkspaceStatePayload {
  workspaceName: string;
  tabs: WorkspaceTab[];
  activeTabId: string;
}

export function setupWorkspaceIpc(mainWindow: BrowserWindow): void {
  ipcMain.handle(WorkspaceChannels.LIST, async () => {
    return await getWorkspacesList();
  });

  ipcMain.handle(WorkspaceChannels.CREATE, async (_event, name: string) => {
    return await createWorkspace(name);
  });

  ipcMain.handle(WorkspaceChannels.SWITCH, async (_event, name: string) => {
    const success = await switchWorkspace(name);
    if (success) {
      const folders = await getWorkspaceFolders();
      setupWatcher(mainWindow, folders);
    }
    return success;
  });

  ipcMain.handle(WorkspaceChannels.ADD_FOLDER, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    if (canceled || filePaths.length === 0) return null;
    const folderPath = filePaths[0];
    const success = await addWorkspaceFolder(folderPath);
    if (success) {
      const folders = await getWorkspaceFolders();
      setupWatcher(mainWindow, folders);
    }
    return folderPath;
  });

  ipcMain.handle(WorkspaceChannels.FOLDER_LIST, async () => {
    return await getWorkspaceFolders();
  });

  ipcMain.handle(WorkspaceChannels.STATE_LOAD, async () => {
    return await getWorkspaceState();
  });

  ipcMain.handle(WorkspaceChannels.STATE_SAVE, async (_event, { workspaceName, tabs, activeTabId }: WorkspaceStatePayload) => {
    const state: Partial<WorkspaceConfig> = { tabs, activeTabId };
    return await saveWorkspaceState(workspaceName, state);
  });


  ipcMain.handle(WorkspaceChannels.FOLDER_REORDER, async (_event, folders: string[]) => {
    const success = await reorderWorkspaceFolders(folders);
    if (success) {
      setupWatcher(mainWindow, folders);
    }
    return success;
  });

  ipcMain.handle(WorkspaceChannels.FOLDER_REMOVE, async (_event, folderPath: string) => {
    const success = await removeWorkspaceFolder(folderPath);
    if (success) {
      const folders = await getWorkspaceFolders();
      setupWatcher(mainWindow, folders);
    }
    return success;
  });

  ipcMain.handle(WorkspaceChannels.FILE_SCAN, async () => {
    const folders = await getWorkspaceFolders();
    const allFiles: any[] = [];
    const ignorePatterns = await getIgnorePatterns();

    async function scan(dir: string) {
      const entries = await readdir(dir);
      for (const file of entries) {
        if (ignorePatterns.includes(file.name)) continue;
        const res = getAbsolutePath(file.name, dir);
        if (file.isDirectory()) {
          await scan(res);
        } else {
          allFiles.push({
            name: file.name,
            path: res,
            isDirectory: false
          });
        }
      }
    }

    for (const folder of folders) {
      if (await exists(folder)) {
        await scan(folder);
      }
    }
    return allFiles;
  });
}
