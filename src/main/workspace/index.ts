import { ipcMain } from 'electron'
import { AppEvents, AppOperation } from '../../lib/constants/app'
import { WorkspaceChannels } from '../../lib/constants/ipc-channels'
import { exists, getAbsolutePath, readdir } from '../../lib/path'
import { getIgnorePatterns } from '../config'
import { gitService } from '../git/index'
import {
  broadcastAppEvent,
  getWinIdFromSender,
  sendOperationToWindow,
  sendToWindow,
  showOpenDialog,
} from '../window'
import { getWindowWorkspace, setWindowWorkspace } from '../window-state'
import {
  addWorkspaceFolder,
  createWorkspace,
  deleteWorkspace,
  getWorkspaceFolders,
  getWorkspaceState,
  getWorkspacesList,
  removeWorkspaceFolder,
  reorderWorkspaceFolders,
  switchWorkspace,
} from './logic'

export function setupWorkspaceIpc(): void {
  const notifyChanged = (winId: number, folders: string[]) => {
    sendToWindow(winId, AppEvents.WORKSPACE_CHANGED, { folders })
    gitService.refreshWatchers(folders)
  }

  ipcMain.handle(WorkspaceChannels.LIST, async () => {
    return await getWorkspacesList()
  })

  ipcMain.handle(WorkspaceChannels.CREATE, async (_event, name: string) => {
    const result = await createWorkspace(name)
    broadcastAppEvent(AppEvents.WORKSPACE_CHANGED, { created: name })
    return result
  })

  ipcMain.handle(WorkspaceChannels.DELETE, async (_event, name: string) => {
    const result = await deleteWorkspace(name)
    broadcastAppEvent(AppEvents.WORKSPACE_CHANGED, { deleted: name })
    return result
  })

  ipcMain.handle(WorkspaceChannels.SWITCH, async (event, name: string) => {
    const winId = getWinIdFromSender(event.sender)

    // Switch the global config (for backward compatibility + new windows)
    const success = await switchWorkspace(name)
    if (success) {
      // Track this window's workspace independently
      setWindowWorkspace(winId, name)
      const folders = await getWorkspaceFolders(name)
      notifyChanged(winId, folders)
    }
    return success
  })

  ipcMain.handle(WorkspaceChannels.ADD_FOLDER, async (event) => {
    const winId = getWinIdFromSender(event.sender)
    const workspaceName = await getWindowWorkspace(winId)

    const { canceled, filePaths } = await showOpenDialog({
      properties: ['openDirectory'],
    })
    if (canceled || filePaths.length === 0) return null
    const folderPath = filePaths[0]
    const result = await addWorkspaceFolder(folderPath, workspaceName)

    if (result.success) {
      const folders = await getWorkspaceFolders(workspaceName)
      notifyChanged(winId, folders)

      // Send detailed update event to this window
      sendToWindow(winId, AppEvents.WORKSPACE_UPDATED, result)

      if (result.reason === 'is_child_of_existing') {
        sendOperationToWindow(winId, AppOperation.SHOW_NOTIFICATION, {
          type: 'info',
          title: 'Folder already covered',
          message: `The folder is already covered by parent: ${result.parentPath}`,
        })
      } else if (result.reason === 'is_parent_of_existing') {
        sendOperationToWindow(winId, AppOperation.SHOW_NOTIFICATION, {
          type: 'success',
          title: 'Workspace updated',
          message: `Replaced ${result.removed.length} subfolder(s) with parent folder.`,
        })
      } else if (result.reason === 'already_exists') {
        sendOperationToWindow(winId, AppOperation.SHOW_NOTIFICATION, {
          type: 'info',
          title: 'Folder already exists',
          message: 'The selected folder is already in the workspace.',
        })
      }
    }
    return folderPath
  })

  ipcMain.handle(WorkspaceChannels.FOLDER_LIST, async (event) => {
    const winId = getWinIdFromSender(event.sender)
    const workspaceName = await getWindowWorkspace(winId)
    return await getWorkspaceFolders(workspaceName)
  })

  ipcMain.handle(WorkspaceChannels.STATE_LOAD, async (event) => {
    const winId = getWinIdFromSender(event.sender)
    const workspaceName = await getWindowWorkspace(winId)
    return await getWorkspaceState(workspaceName)
  })

  ipcMain.handle(
    WorkspaceChannels.FOLDER_REORDER,
    async (event, folders: string[]) => {
      const winId = getWinIdFromSender(event.sender)
      const workspaceName = await getWindowWorkspace(winId)
      const success = await reorderWorkspaceFolders(folders, workspaceName)
      if (success) {
        notifyChanged(winId, folders)
      }
      return success
    },
  )

  ipcMain.handle(
    WorkspaceChannels.FOLDER_REMOVE,
    async (event, folderPath: string) => {
      const winId = getWinIdFromSender(event.sender)
      const workspaceName = await getWindowWorkspace(winId)
      const success = await removeWorkspaceFolder(folderPath, workspaceName)
      if (success) {
        const folders = await getWorkspaceFolders(workspaceName)
        notifyChanged(winId, folders)
      }
      return success
    },
  )

  ipcMain.handle(WorkspaceChannels.FILE_SCAN, async (event) => {
    const winId = getWinIdFromSender(event.sender)
    const workspaceName = await getWindowWorkspace(winId)
    const folders = await getWorkspaceFolders(workspaceName)
    const allFiles: { name: string; path: string; isDirectory: boolean }[] = []
    const ignorePatterns = await getIgnorePatterns()

    async function scan(dir: string) {
      const entries = await readdir(dir)
      for (const file of entries) {
        if (ignorePatterns.includes(file.name)) continue
        const res = getAbsolutePath(file.name, dir)
        if (file.isDirectory()) {
          await scan(res)
        } else {
          allFiles.push({
            name: file.name,
            path: res,
            isDirectory: false,
          })
        }
      }
    }

    for (const folder of folders) {
      if (await exists(folder)) {
        await scan(folder)
      }
    }
    return allFiles
  })
}

export {
  addWorkspaceFolder,
  createWorkspace,
  deleteWorkspace,
  getWorkspaceFolders,
  getWorkspaceState,
  getWorkspacesList,
  removeWorkspaceFolder,
  renameWorkspaceFolder,
  reorderWorkspaceFolders,
  saveWorkspaceState,
  switchWorkspace,
  updateTileData,
} from './logic'
