import { BrowserWindow } from 'electron';
import { FSWatcher, watch } from 'chokidar';
import {
  getBasename,
} from '../../lib/path';
import { getIgnorePatterns } from '../config';
import { FileEventChannels } from '../../lib/constants/ipc-channels';


let watcher: FSWatcher | null = null;

export function setupWatcher(mainWindow: BrowserWindow, folders: string[]) {
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
        mainWindow.webContents.send(FileEventChannels.FS_CHANGE, { event, path });
      }
    });
  }).catch(e => {
    console.error('Error in setupWatcher ignore patterns:', e);
  });
}
