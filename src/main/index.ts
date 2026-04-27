import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import chokidar from 'chokidar';
import { initAppFolders, loadConfig, saveConfig, getWorkspacesList, createWorkspace, switchWorkspace, addWorkspaceFolder, getWorkspaceFolders, getWorkspaceState, saveWorkspaceState, removeWorkspaceFolder, renameWorkspaceFolder } from './config';

const execAsync = promisify(exec);

let mainWindow: BrowserWindow | null = null;
let watcher: chokidar.FSWatcher | null = null;

function setupWatcher(folders: string[]) {
  if (watcher) {
    watcher.close();
  }
  
  if (folders.length === 0) return;

  watcher = chokidar.watch(folders, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: true,
    depth: 99
  });

  watcher.on('all', (event, path) => {
    if (mainWindow) {
      mainWindow.webContents.send('api:fs-change', { event, path });
    }
  });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  });

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
  
  mainWindow.setMenuBarVisibility(false);
}

if (process.platform === 'linux') {
  app.commandLine.appendSwitch('enable-wayland-ime');
  app.commandLine.appendSwitch('wayland-text-input-v3');
}

app.whenReady().then(async () => {
  await initAppFolders();
  createWindow();

  // Initial watcher setup
  const folders = await getWorkspaceFolders();
  setupWatcher(folders);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers ported from express server.ts
ipcMain.handle('api:files', async (event, dirPath: string = '.') => {
  try {
    const resolvedPath = require('path').resolve(dirPath);
    const files = await fs.readdir(resolvedPath, { withFileTypes: true });
    
    const result = files.map(file => ({
      name: file.name,
      isDirectory: file.isDirectory(),
      path: require('path').join(resolvedPath, file.name)
    }));
    
    result.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });

    return { data: result };
  } catch (error: any) {
    return { error: error.message };
  }
});

ipcMain.handle('api:command', async (event, { command, cwd }: { command: string, cwd?: string }) => {
  try {
    const { stdout, stderr } = await execAsync(command, { cwd: cwd || process.cwd() });
    return { data: { stdout, stderr } };
  } catch (error: any) {
    return { error: error.message, stdout: error.stdout, stderr: error.stderr };
  }
});

ipcMain.handle('api:read-file', async (event, filePath: string) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return { data: content };
  } catch (error: any) {
    return { error: error.message };
  }
});

ipcMain.handle('api:load-config', async () => {
  try {
    const config = await loadConfig();
    return { data: config };
  } catch (error: any) {
    return { error: error.message };
  }
});

ipcMain.handle('api:save-config', async (event, config) => {
  try {
    await saveConfig(config);
    return { data: true };
  } catch (error: any) {
    return { error: error.message };
  }
});

// Workspace IPC handlers
ipcMain.handle('api:workspaces-list', async () => {
  try {
    const list = await getWorkspacesList();
    return { data: list };
  } catch (error: any) {
    return { error: error.message };
  }
});

ipcMain.handle('api:workspace-create', async (event, name: string) => {
  try {
    const ws = await createWorkspace(name);
    return { data: ws };
  } catch (error: any) {
    return { error: error.message };
  }
});

ipcMain.handle('api:workspace-switch', async (event, name: string) => {
  try {
    const ws = await switchWorkspace(name);
    const folders = await getWorkspaceFolders();
    setupWatcher(folders);
    return { data: ws };
  } catch (error: any) {
    return { error: error.message };
  }
});

ipcMain.handle('api:workspace-add-folder', async () => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory']
    });
    if (canceled || filePaths.length === 0) return { data: null };
    
    await addWorkspaceFolder(filePaths[0]);
    const folders = await getWorkspaceFolders();
    setupWatcher(folders);
    return { data: filePaths[0] };
  } catch (error: any) {
    return { error: error.message };
  }
});

ipcMain.handle('api:workspace-get-folders', async () => {
  try {
    const folders = await getWorkspaceFolders();
    return { data: folders };
  } catch (error: any) {
    return { error: error.message };
  }
});

ipcMain.handle('api:workspace-remove-folder', async (event, folderPath: string) => {
  try {
    await removeWorkspaceFolder(folderPath);
    const folders = await getWorkspaceFolders();
    setupWatcher(folders);
    return { data: true };
  } catch (error: any) {
    return { error: error.message };
  }
});

ipcMain.handle('api:workspace-get-state', async () => {
  try {
    const state = await getWorkspaceState();
    return { data: state };
  } catch (error: any) {
    return { error: error.message };
  }
});

ipcMain.handle('api:workspace-save-state', async (event, { tabs, activeTabId }: { tabs: any[], activeTabId: string }) => {
  try {
    await saveWorkspaceState(tabs, activeTabId);
    return { data: true };
  } catch (error: any) {
    return { error: error.message };
  }
});

// File manipulation IPC handlers
ipcMain.handle('api:file-create', async (event, { path: filePath, isDirectory }) => {
  try {
    if (isDirectory) {
      await fs.mkdir(filePath, { recursive: true });
    } else {
      await fs.writeFile(filePath, '', 'utf-8');
    }
    return { data: true };
  } catch (error: any) {
    return { error: error.message };
  }
});

ipcMain.handle('api:file-rename', async (event, { oldPath, newPath }) => {
  try {
    await fs.rename(oldPath, newPath);
    await renameWorkspaceFolder(oldPath, newPath);
    return { data: true };
  } catch (error: any) {
    return { error: error.message };
  }
});

ipcMain.handle('api:file-delete', async (event, filePath: string) => {
  try {
    await fs.rm(filePath, { recursive: true, force: true });
    await removeWorkspaceFolder(filePath);
    return { data: true };
  } catch (error: any) {
    return { error: error.message };
  }
});

ipcMain.handle('api:file-save', async (event, { path: filePath, content }) => {
  try {
    await fs.writeFile(filePath, content, 'utf-8');
    return { data: true };
  } catch (error: any) {
    return { error: error.message };
  }
});

