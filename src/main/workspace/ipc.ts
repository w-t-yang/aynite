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
} from './workspace';
import { getIgnorePatterns } from '../config';
import { exists, readdir, getAbsolutePath } from '../../lib/path';
import { WorkspaceTab } from '../../lib/types/workspace';

export function setupWorkspaceIpc(mainWindow: BrowserWindow, setupWatcher: (folders: string[]) => void): void {
  ipcMain.handle('aynite:workspaces-list', async () => {
    return await getWorkspacesList();
  });

  ipcMain.handle('aynite:workspace-create', async (_event, name: string) => {
    return await createWorkspace(name);
  });

  ipcMain.handle('aynite:workspace-switch', async (_event, name: string) => {
    const ws = await switchWorkspace(name);
    const folders = await getWorkspaceFolders();
    setupWatcher(folders);
    return ws;
  });

  ipcMain.handle('aynite:workspace-add-folder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    if (canceled || filePaths.length === 0) return null;

    await addWorkspaceFolder(filePaths[0]);
    const folders = await getWorkspaceFolders();
    setupWatcher(folders);
    return filePaths[0];
  });

  ipcMain.handle('aynite:workspace-remove-folder', async (_event, folderPath: string) => {
    await removeWorkspaceFolder(folderPath);
    const folders = await getWorkspaceFolders();
    setupWatcher(folders);
    return true;
  });

  ipcMain.handle('aynite:workspace-reorder-folders', async (_event, folders: string[]) => {
    await reorderWorkspaceFolders(folders);
    setupWatcher(folders);
    return true;
  });

  ipcMain.handle('aynite:workspace-get-folders', async () => {
    return await getWorkspaceFolders();
  });

  ipcMain.handle('aynite:workspace-get-state', async () => {
    return await getWorkspaceState();
  });

  ipcMain.handle('aynite:workspace-save-state', async (_event, payload: { name: string, tabs: WorkspaceTab[], activeTabId: string }) => {
    await saveWorkspaceState(payload.name, payload.tabs, payload.activeTabId);
    return true;
  });

  ipcMain.handle('aynite:workspace-all-files', async () => {
    const folders = await getWorkspaceFolders();
    const ignorePatterns = await getIgnorePatterns();
    const allFiles: { name: string, path: string, isDirectory: boolean }[] = [];

    async function scan(dir: string) {
      const list = await readdir(dir);
      for (const file of list) {
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
