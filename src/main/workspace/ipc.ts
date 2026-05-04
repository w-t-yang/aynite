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

export function setupWorkspaceIpc(mainWindow: BrowserWindow): void {
  ipcMain.handle('aynite:workspace-list', async () => {
    return await getWorkspacesList();
  });

  ipcMain.handle('aynite:workspace-create', async (event, name: string) => {
    return await createWorkspace(name);
  });

  ipcMain.handle('aynite:workspace-switch', async (event, name: string) => {
    const success = await switchWorkspace(name);
    if (success) {
      const folders = await getWorkspaceFolders();
      setupWatcher(mainWindow, folders);
    }
    return success;
  });

  ipcMain.handle('aynite:workspace-add-folder', async () => {
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

  ipcMain.handle('aynite:workspace-folder-list', async () => {
    return await getWorkspaceFolders();
  });

  ipcMain.handle('aynite:workspace-state-load', async () => {
    return await getWorkspaceState();
  });

  ipcMain.handle('aynite:workspace-state-save', async (event, { workspaceName, tabs, activeTabId }: { workspaceName: string, tabs: WorkspaceTab[], activeTabId: string }) => {
    return await saveWorkspaceState(workspaceName, tabs, activeTabId);
  });

  ipcMain.handle('aynite:workspace-folder-reorder', async (event, folders: string[]) => {
    const success = await reorderWorkspaceFolders(folders);
    if (success) {
      setupWatcher(mainWindow, folders);
    }
    return success;
  });

  ipcMain.handle('aynite:workspace-folder-remove', async (event, folderPath: string) => {
    const success = await removeWorkspaceFolder(folderPath);
    if (success) {
      const folders = await getWorkspaceFolders();
      setupWatcher(mainWindow, folders);
    }
    return success;
  });

  ipcMain.handle('aynite:workspace-file-scan', async () => {
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
