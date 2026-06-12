/**
 * Bridge module: File operations
 *
 * Typed getters and setters for file system operations.
 * Setters return Promise<void> — fs-change events will update views.
 */

function getAynite() {
  if (!window.aynite) {
    throw new Error('Aynite bridge not available (not running in Electron?)')
  }
  return window.aynite
}

interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
}

interface FileInfo {
  name: string
  size: number
  createdAt: string
  modifiedAt: string
  isDirectory: boolean
  path: string
  extension: string
  isText: boolean
}

// ── Getters (return data) ────────────────────────────────────────────

export const file = (() => ({
  read: (path: string): Promise<string> => getAynite().readFile(path),

  readBinary: (path: string): Promise<Uint8Array> =>
    getAynite().readFileBinary(path),

  list: (path: string): Promise<FileEntry[]> => getAynite().listFolder(path),

  info: (path: string): Promise<FileInfo> => getAynite().getFileInfo(path),

  checkIsText: (path: string): Promise<boolean> =>
    getAynite().checkIsTextFile(path),
}))()

// ── Setters (return void ── state changes come through events) ───────

export const fileMutations = (() => ({
  write: (path: string, content: string): Promise<void> =>
    getAynite()
      .writeFile(path, content)
      .then(() => {}),

  watch: (path: string | null): Promise<void> => getAynite().watchFile(path),

  create: (path: string, isDirectory: boolean): Promise<void> =>
    getAynite()
      .createFile(path, isDirectory)
      .then(() => {}),

  rename: (oldPath: string, newPath: string): Promise<void> =>
    getAynite()
      .renameFile(oldPath, newPath)
      .then(() => {}),

  copy: (srcPath: string, destPath: string): Promise<void> =>
    getAynite()
      .copyFile(srcPath, destPath)
      .then(() => {}),

  delete: (path: string): Promise<void> =>
    getAynite()
      .deleteFile(path)
      .then(() => {}),

  open: (path: string): Promise<boolean> => getAynite().openFile(path),
}))()

// ── Legacy file operations available on window.aynite ────────────────
// These are inconsistently named in the preload but still used.

export const legacyFile = (() => ({
  getFiles: (path: string): Promise<FileEntry[]> => getAynite().getFiles(path),

  move: (oldPath: string, newPath: string): Promise<boolean> =>
    getAynite().move(oldPath, newPath),

  remove: (path: string): Promise<boolean> => getAynite().remove(path),

  copyClip: (path: string): Promise<boolean> => getAynite().copy(path),

  paste: (destDir: string): Promise<boolean> => getAynite().paste(destDir),

  onFileSystemChange: (
    cb: (data: { event: string; path: string }) => void,
  ): (() => void) => getAynite().onFileSystemChange(cb),
}))()
