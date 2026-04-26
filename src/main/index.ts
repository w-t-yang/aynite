import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import { initAppFolders, loadConfig, saveConfig } from './config';

const execAsync = promisify(exec);

let mainWindow: BrowserWindow | null = null;

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

app.whenReady().then(async () => {
  await initAppFolders();
  createWindow();

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
