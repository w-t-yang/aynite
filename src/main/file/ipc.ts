import { ipcMain } from 'electron';
import { 
  getAbsolutePath, 
  expandHome, 
  joinPaths, 
  getExtname, 
  getDirname,
  readdir,
  readText,
  writeText,
  stat,
  ensureDir,
  rename,
  copy,
  remove,
  checkIsTextFile
} from '../../lib/path';
import { getIgnorePatterns } from '../config';
import { renameWorkspaceFolder, removeWorkspaceFolder } from '../workspace';

export function setupFileIpc() {
  ipcMain.handle('aynite:file-list', async (event, dirPath: string = '.') => {
    try {
      const resolvedPath = getAbsolutePath(expandHome(dirPath));
      const files = await readdir(resolvedPath);

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
      console.error('aynite:file-list error:', error);
      throw error;
    }
  });

  ipcMain.handle('aynite:file-read', async (event, filePath: string) => {
    try {
      return await readText(filePath);
    } catch (error: any) {
      throw error;
    }
  });

  ipcMain.handle('aynite:file-info', async (event, filePath: string) => {
    try {
      const expandedPath = expandHome(filePath);
      const s = await stat(expandedPath);
      const isText = s.isDirectory() ? false : await checkIsTextFile(expandedPath);

      return {
        size: s.size,
        createdAt: s.birthtime,
        modifiedAt: s.mtime,
        isDirectory: s.isDirectory(),
        path: expandedPath,
        extension: getExtname(expandedPath).toLowerCase().slice(1),
        isText
      };
    } catch (error: any) {
      throw error;
    }
  });

  ipcMain.handle('aynite:file-create', async (event, { path: filePath, isDirectory }) => {
    if (isDirectory) {
      await ensureDir(filePath);
    } else {
      await writeText(filePath, '');
    }
    return true;
  });

  ipcMain.handle('aynite:file-rename', async (event, { oldPath, newPath }) => {
    await rename(oldPath, newPath);
    await renameWorkspaceFolder(oldPath, newPath);
    return true;
  });

  ipcMain.handle('aynite:file-copy', async (event, { srcPath, destPath }) => {
    await copy(srcPath, destPath, { recursive: true });
    return true;
  });

  ipcMain.handle('aynite:file-delete', async (event, filePath: string) => {
    await remove(filePath, { recursive: true, force: true });
    await removeWorkspaceFolder(filePath);
    return true;
  });

  ipcMain.handle('aynite:file-save', async (event, { path: filePath, content }) => {
    await writeText(filePath, content);
    return true;
  });
}
