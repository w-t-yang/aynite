import { app, BrowserWindow, ipcMain, dialog, Menu, protocol, net, shell } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import os from 'os';
import { FSWatcher, watch } from 'chokidar';
import { initAppFolders, loadConfig, saveConfig, restoreDefaultSkills, restoreDefaultCommands, listAvailableSkills, listAvailableCommands, getThemesList, getTheme, saveTheme, restoreDefaultTheme, deleteTheme, getSystemFonts, getIgnorePatterns, setConfigNotificationCallback } from './config';
import { joinPaths, getDirname, getAbsolutePath, getExtname, getBasename, expandHome, getPreloadPath, getRendererHtmlPath } from '../lib/path';
import { setupAiIpc } from './ai';
import { setupWorkspaceIpc, getWorkspaceFolders, renameWorkspaceFolder } from './workspace';
import { setupUpdater } from './updater';


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
        const basename = getBasename(p);
        if (folders.includes(p)) return false;
        return Array.isArray(ignorePatterns) && ignorePatterns.includes(basename);
      },
      persistent: true,
      ignoreInitial: true,
      depth: 99
    });

    watcher.on('all', (event, path) => {
      if (mainWindow) {
        mainWindow.webContents.send('aynite:fs-change', { event, path });
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
    title: 'Aynite',
    autoHideMenuBar: true,
    webPreferences: {
      preload: getPreloadPath(__dirname),
      sandbox: false,
      contextIsolation: true
    }
  });

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(getRendererHtmlPath(__dirname));
  }

  mainWindow.setMenuBarVisibility(false);
}

if (process.platform === 'linux') {
  app.commandLine.appendSwitch('enable-wayland-ime');
  app.commandLine.appendSwitch('wayland-text-input-v3');
}

app.whenReady().then(async () => {
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
  if (mainWindow) {
    setupAiIpc(mainWindow);
    setupWorkspaceIpc(mainWindow, setupWatcher);
    setupUpdater(mainWindow);

    // Set up configuration error notifications
    setConfigNotificationCallback((data) => {
      if (mainWindow) {
        mainWindow.webContents.send('aynite:config-error', data);
      }
    });
  }


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
  //if (process.platform !== 'darwin') {
  //  app.quit();
  //}
  app.quit();
});


// IPC handlers ported from express server.ts
ipcMain.handle('aynite:files', async (event, dirPath: string = '.') => {
  try {
    const resolvedPath = getAbsolutePath(expandHome(dirPath));
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
        path: joinPaths(resolvedPath, file.name)
      }));

    result.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
    return result;
  } catch (error: any) {
    console.error('aynite:files error:', error);
    throw error;
  }
});

ipcMain.handle('aynite:command', async (event, { command, cwd }: { command: string, cwd?: string }) => {
  const { stdout, stderr } = await execAsync(command, { cwd: cwd || process.cwd() });
  return { stdout, stderr };
});

ipcMain.handle('aynite:command-run-direct', async (event, { commandPath, params, currentFile }: { commandPath: string, params: string[], currentFile?: string }) => {
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

ipcMain.handle('aynite:read-file', async (event, filePath: string) => {
  try {
    return await fs.readFile(expandHome(filePath), 'utf-8');
  } catch (error: any) {
    throw error;
  }
});

async function checkIsTextFile(filePath: string): Promise<boolean> {
  try {
    const fd = await fs.open(filePath, 'r');
    const { bytesRead, buffer } = await fd.read(Buffer.alloc(1024), 0, 1024, 0);
    await fd.close();

    for (let i = 0; i < bytesRead; i++) {
      if (buffer[i] === 0) return false;
    }
    return true;
  } catch {
    return false;
  }
}

ipcMain.handle('aynite:file-info', async (event, filePath: string) => {
  try {
    const expandedPath = expandHome(filePath);
    const stats = await fs.stat(expandedPath);
    const isText = stats.isDirectory() ? false : await checkIsTextFile(expandedPath);

    return {
      size: stats.size,
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime,
      isDirectory: stats.isDirectory(),
      path: expandedPath,
      extension: getExtname(expandedPath).toLowerCase().slice(1),
      isText
    };
  } catch (error: any) {
    throw error;
  }
});

ipcMain.handle('aynite:load-config', async () => {
  return await loadConfig();
});

ipcMain.handle('aynite:save-config', async (event, config) => {
  await saveConfig(config);
  return true;
});

ipcMain.handle('aynite:skill-add-folder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory']
  });
  if (canceled || filePaths.length === 0) return null;
  return filePaths[0];
});

ipcMain.handle('aynite:skills-restore-default', async () => {
  return await restoreDefaultSkills();
});

ipcMain.handle('aynite:command-add-folder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory']
  });
  if (canceled || filePaths.length === 0) return null;
  return filePaths[0];
});

ipcMain.handle('aynite:commands-restore-default', async () => {
  return await restoreDefaultCommands();
});

ipcMain.handle('aynite:skills-list', async () => {
  return await listAvailableSkills();
});

ipcMain.handle('aynite:commands-list', async () => {
  return await listAvailableCommands();
});


ipcMain.handle('aynite:ai-pick-prompt-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    filters: [{ name: 'Markdown', extensions: ['md'] }]
  });
  if (canceled || filePaths.length === 0) return null;
  return filePaths[0];
});

// Prompt IPC handlers moved to src/main/ai/ipc.ts

// Theme IPC handlers
ipcMain.handle('aynite:themes-list', async () => {
  return await getThemesList();
});

ipcMain.handle('aynite:theme-get', async (event, name: string) => {
  return await getTheme(name);
});

ipcMain.handle('aynite:theme-save', async (event, { name, data }) => {
  await saveTheme(name, data);
  return true;
});

ipcMain.handle('aynite:theme-restore-default', async (event, name: string) => {
  return await restoreDefaultTheme(name);
});

ipcMain.handle('aynite:theme-delete', async (event, name: string) => {
  return await deleteTheme(name);
});

ipcMain.handle('aynite:system-fonts', async () => {
  return await getSystemFonts();
});

// File manipulation IPC handlers
ipcMain.handle('aynite:file-create', async (event, { path: filePath, isDirectory }) => {
  if (isDirectory) {
    await fs.mkdir(filePath, { recursive: true });
  } else {
    await fs.writeFile(filePath, '', 'utf-8');
  }
  return true;
});

ipcMain.handle('aynite:file-rename', async (event, { oldPath, newPath }) => {
  await fs.rename(oldPath, newPath);
  await renameWorkspaceFolder(oldPath, newPath);
  return true;
});

ipcMain.handle('aynite:file-copy', async (event, { srcPath, destPath }) => {
  await fs.cp(srcPath, destPath, { recursive: true });
  return true;
});

ipcMain.handle('aynite:file-delete', async (event, filePath: string) => {
  await fs.rm(filePath, { recursive: true, force: true });
  await removeWorkspaceFolder(filePath);
  return true;
});

ipcMain.handle('aynite:file-save', async (event, { path: filePath, content }) => {
  const expandedPath = expandHome(filePath);
  await fs.mkdir(getDirname(expandedPath), { recursive: true });
  await fs.writeFile(expandedPath, content, 'utf-8');
  return true;
});

ipcMain.handle('aynite:open-external', async (event, url: string) => {
  await shell.openExternal(url);
  return true;
});

ipcMain.handle('aynite:app-version', () => {
  return app.getVersion();
});

ipcMain.handle('aynite:app-quit', () => {
  app.quit();
});
