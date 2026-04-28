import { app, BrowserWindow, ipcMain, dialog, Menu, protocol, net } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';
import { FSWatcher, watch } from 'chokidar';
import { initAppFolders, loadConfig, saveConfig, getWorkspacesList, createWorkspace, switchWorkspace, addWorkspaceFolder, getWorkspaceFolders, getWorkspaceState, saveWorkspaceState, removeWorkspaceFolder, renameWorkspaceFolder, reorderWorkspaceFolders, restoreDefaultSkills, restoreDefaultCommands, listAvailableSkills, listAvailableCommands, getThemesList, getTheme, saveTheme, restoreDefaultTheme, deleteTheme, getSystemFonts, getIgnorePatterns } from './config';

const execAsync = promisify(exec);

protocol.registerSchemesAsPrivileged([
  { scheme: 'aynite-resource', privileges: { secure: true, standard: true, supportFetchAPI: true, bypassCSP: true, stream: true } }
]);

let mainWindow: BrowserWindow | null = null;
let watcher: FSWatcher | null = null;

function setupWatcher(folders: string[]) {
  if (watcher) {
    watcher.close();
  }
  
  if (folders.length === 0) return;
  
  getIgnorePatterns().then(ignorePatterns => {
    watcher = watch(folders, {
      ignored: (p) => {
        const basename = path.basename(p);
        if (folders.includes(p)) return false;
        return Array.isArray(ignorePatterns) && ignorePatterns.includes(basename);
      },
      persistent: true,
      ignoreInitial: true,
      depth: 99
    });

    watcher.on('all', (event, path) => {
      if (mainWindow) {
        mainWindow.webContents.send('api:fs-change', { event, path });
      }
    });
  }).catch(e => {
    console.error('Error in setupWatcher ignore patterns:', e);
  });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  });

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
  
  mainWindow.setMenuBarVisibility(false);
}

if (process.platform === 'linux') {
  app.commandLine.appendSwitch('enable-wayland-ime');
  app.commandLine.appendSwitch('wayland-text-input-v3');
}

app.whenReady().then(async () => {
  const { protocol, net } = await import('electron');
  protocol.handle('aynite-resource', (request) => {
    const url = request.url.replace('aynite-resource://', '');
    try {
      const decodedPath = decodeURIComponent(url);
      const fileUrl = 'file://' + (decodedPath.startsWith('/') ? '' : '/') + decodedPath;
      return net.fetch(fileUrl);
    } catch (e) {
      console.error('Failed to handle resource request:', e);
      return new Response('File not found', { status: 404 });
    }
  });

  await initAppFolders();
  createWindow();

  // Initial watcher setup
  const foldersRes = await getWorkspaceFolders();
  setupWatcher(foldersRes.data);

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

// Helper to expand ~ to home directory
function expandHome(filepath: string): string {
  if (filepath.startsWith('~')) {
    return path.join(os.homedir(), filepath.slice(1));
  }
  return filepath;
}

// IPC handlers ported from express server.ts
ipcMain.handle('api:files', async (event, dirPath: string = '.') => {
  try {
    const resolvedPath = path.resolve(expandHome(dirPath));
    const files = await fs.readdir(resolvedPath, { withFileTypes: true });
    
    let ignorePatterns: string[] = [];
    try {
      ignorePatterns = await getIgnorePatterns();
    } catch (e) {
      console.error('Failed to get ignore patterns', e);
    }

    const result = files
      .filter(file => !Array.isArray(ignorePatterns) || !ignorePatterns.includes(file.name))
      .map(file => ({
        name: file.name,
        isDirectory: file.isDirectory(),
        path: path.join(resolvedPath, file.name)
      }));
    
    result.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });

    return { data: result, debug: { resolvedPath, ignorePatterns } };
  } catch (error: any) {
    console.error('api:files error:', error);
    return { error: error.message, debug: { dirPath } };
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

ipcMain.handle('api:command-run-direct', async (event, { commandPath, params, currentFile }: { commandPath: string, params: string[], currentFile?: string }) => {
  try {
    const runShPath = path.join(commandPath, 'run.sh');
    // Ensure execute permission
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

    // Automatically resolve Aynite mentions (e.g., @file[label](path)) to raw paths
    const resolvedParams = params.map(p => {
      return p.replace(/@(?:file|skill|cmd)\[.*?\]\((.*?)\)/g, '$1');
    });

    // Construct the command. We wrap params in quotes to handle spaces.
    const quotedParams = resolvedParams.map(p => `"${p.replace(/"/g, '\\"')}"`).join(' ');
    const fullCmd = process.platform === 'win32' ? `sh "${runShPath}" ${quotedParams}` : `"${runShPath}" ${quotedParams}`;

    const { stdout, stderr } = await execAsync(fullCmd, { 
      cwd: commandPath,
      env
    });
    return { data: { stdout, stderr } };
  } catch (error: any) {
    return { error: error.message, stdout: error.stdout, stderr: error.stderr };
  }
});

ipcMain.handle('api:read-file', async (event, filePath: string) => {
  try {
    const content = await fs.readFile(expandHome(filePath), 'utf-8');
    return { data: content };
  } catch (error: any) {
    return { error: error.message };
  }
});

async function checkIsTextFile(filePath: string): Promise<boolean> {
  try {
    const fd = await fs.open(filePath, 'r');
    const { buffer } = await fd.read(Buffer.alloc(1024), 0, 1024, 0);
    await fd.close();
    
    for (let i = 0; i < buffer.length; i++) {
      if (buffer[i] === 0) return false;
    }
    return true;
  } catch {
    return false;
  }
}

ipcMain.handle('api:file-info', async (event, filePath: string) => {
  try {
    const expandedPath = expandHome(filePath);
    const stats = await fs.stat(expandedPath);
    const isText = stats.isDirectory() ? false : await checkIsTextFile(expandedPath);
    
    return {
      data: {
        size: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        isDirectory: stats.isDirectory(),
        path: expandedPath,
        extension: path.extname(expandedPath).toLowerCase().slice(1),
        isText
      }
    };
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
    const foldersRes = await getWorkspaceFolders();
    setupWatcher(foldersRes.data);
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
    const foldersRes = await getWorkspaceFolders();
    setupWatcher(foldersRes.data);
    return { data: filePaths[0] };
  } catch (error: any) {
    return { error: error.message };
  }
});

ipcMain.handle('api:workspace-get-folders', async () => {
  try {
    return await getWorkspaceFolders();
  } catch (error: any) {
    return { data: [], error: error.message };
  }
});

ipcMain.handle('api:workspace-all-files', async () => {
  try {
    const foldersRes = await getWorkspaceFolders();
    const folders = foldersRes.data;
    const ignorePatterns = await getIgnorePatterns();
    let allFiles: any[] = [];

    async function scan(dir: string) {
      const list = await fs.readdir(dir, { withFileTypes: true });
      for (const file of list) {
        if (ignorePatterns.includes(file.name)) continue;
        const res = path.resolve(dir, file.name);
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
      if (existsSync(folder)) {
        await scan(folder);
      }
    }

    return { data: allFiles };
  } catch (error: any) {
    return { error: error.message };
  }
});

ipcMain.handle('api:workspace-remove-folder', async (event, folderPath: string) => {
  try {
    await removeWorkspaceFolder(folderPath);
    const foldersRes = await getWorkspaceFolders();
    setupWatcher(foldersRes.data);
    return { data: true };
  } catch (error: any) {
    return { error: error.message };
  }
});

ipcMain.handle('api:workspace-reorder-folders', async (event, folders: string[]) => {
  try {
    await reorderWorkspaceFolders(folders);
    const updatedFoldersRes = await getWorkspaceFolders();
    setupWatcher(updatedFoldersRes.data);
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

ipcMain.handle('api:workspace-save-state', async (event, { workspaceName, tabs, activeTabId }: { workspaceName: string, tabs: any[], activeTabId: string }) => {
  try {
    await saveWorkspaceState(workspaceName, tabs, activeTabId);
    return { data: true };
  } catch (error: any) {
    return { error: error.message };
  }
});

ipcMain.handle('api:skill-add-folder', async () => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory']
    });
    if (canceled || filePaths.length === 0) return { data: null };
    return { data: filePaths[0] };
  } catch (error: any) {
    return { error: error.message };
  }
});

ipcMain.handle('api:skills-restore-default', async () => {
  try {
    const success = await restoreDefaultSkills();
    return { data: success };
  } catch (error: any) {
    return { error: error.message };
  }
});

ipcMain.handle('api:command-add-folder', async () => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory']
    });
    if (canceled || filePaths.length === 0) return { data: null };
    return { data: filePaths[0] };
  } catch (error: any) {
    return { error: error.message };
  }
});

ipcMain.handle('api:commands-restore-default', async () => {
  try {
    const success = await restoreDefaultCommands();
    return { data: success };
  } catch (error: any) {
    return { error: error.message };
  }
});

ipcMain.handle('api:skills-list', async () => {
  try {
    const skills = await listAvailableSkills();
    return { data: skills };
  } catch (error: any) {
    return { error: error.message };
  }
});

ipcMain.handle('api:commands-list', async () => {
  try {
    const commands = await listAvailableCommands();
    return { data: commands };
  } catch (error: any) {
    return { error: error.message };
  }
});

// Theme IPC handlers
ipcMain.handle('api:themes-list', async () => {
  try {
    const themes = await getThemesList();
    return { data: themes };
  } catch (error: any) {
    return { error: error.message };
  }
});

ipcMain.handle('api:theme-get', async (event, name: string) => {
  try {
    const theme = await getTheme(name);
    return { data: theme };
  } catch (error: any) {
    return { error: error.message };
  }
});

ipcMain.handle('api:theme-save', async (event, { name, data }) => {
  try {
    await saveTheme(name, data);
    return { data: true };
  } catch (error: any) {
    return { error: error.message };
  }
});

ipcMain.handle('api:theme-restore-default', async (event, name: string) => {
  try {
    const result = await restoreDefaultTheme(name);
    return { data: result };
  } catch (error: any) {
    return { error: error.message };
  }
});

ipcMain.handle('api:theme-delete', async (event, name: string) => {
  try {
    const result = await deleteTheme(name);
    return { data: result };
  } catch (error: any) {
    return { error: error.message };
  }
});

ipcMain.handle('api:system-fonts', async () => {
  try {
    const fonts = await getSystemFonts();
    return { data: fonts };
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

ipcMain.handle('api:file-copy', async (event, { srcPath, destPath }) => {
  try {
    await fs.cp(srcPath, destPath, { recursive: true });
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
    const expandedPath = expandHome(filePath);
    await fs.mkdir(require('path').dirname(expandedPath), { recursive: true });
    await fs.writeFile(expandedPath, content, 'utf-8');
    return { data: true };
  } catch (error: any) {
    return { error: error.message };
  }
});

ipcMain.handle('api:app-quit', () => {
  app.quit();
});
