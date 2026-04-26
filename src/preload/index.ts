import { contextBridge, ipcRenderer } from 'electron';

const api = {
  getFiles: (path: string) => ipcRenderer.invoke('api:files', path),
  runCommand: (command: string, cwd?: string) => ipcRenderer.invoke('api:command', { command, cwd }),
  readFile: (path: string) => ipcRenderer.invoke('api:read-file', path)
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', { ipcRenderer });
    contextBridge.exposeInMainWorld('api', api);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore
  window.electron = { ipcRenderer };
  // @ts-ignore
  window.api = api;
}
