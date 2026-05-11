import { ipcMain } from 'electron'
import { RssChannels } from '../../lib/constants/ipc-channels'
import * as logic from './logic'

export function setupRssIpc() {
  // Ensure RSS directory and subdirectories exist
  logic.initRss()

  ipcMain.handle(RssChannels.GET_CONFIG, async () => {
    return await logic.getConfig()
  })

  ipcMain.handle(RssChannels.SAVE_CONFIG, async (_event, config: any) => {
    await logic.saveConfig(config)
    return true
  })

  ipcMain.handle(RssChannels.FETCH_FEED, async (_event, sourceId: string) => {
    const config = await logic.getConfig()
    return await logic.fetchSource(config, sourceId)
  })

  ipcMain.handle(RssChannels.FETCH_ALL, async () => {
    const config = await logic.getConfig()
    return await logic.fetchAll(config)
  })

  ipcMain.handle(RssChannels.GET_CONTENT, async (_event, sourceId: string) => {
    return await logic.getContent(sourceId)
  })

  ipcMain.handle(RssChannels.GET_ALL_CONTENTS, async () => {
    const config = await logic.getConfig()
    return await logic.getAllContents(config)
  })

  ipcMain.handle(RssChannels.GET_BOOKMARKS, async () => {
    return await logic.getBookmarks()
  })

  ipcMain.handle(
    RssChannels.TOGGLE_BOOKMARK,
    async (_event, { itemId, data }: { itemId: string; data: any }) => {
      return await logic.toggleBookmark(itemId, data)
    },
  )

  ipcMain.handle(
    RssChannels.MARK_READ,
    async (
      _event,
      { sourceId, itemId }: { sourceId: string; itemId: string },
    ) => {
      await logic.markRead(sourceId, itemId)
      return true
    },
  )

  ipcMain.handle(
    RssChannels.MARK_ALL_READ,
    async (_event, sourceId: string) => {
      await logic.markAllRead(sourceId)
      return true
    },
  )

  ipcMain.handle(
    RssChannels.DELETE_SOURCE_CONTENT,
    async (_event, sourceId: string) => {
      await logic.deleteContent(sourceId)
      return true
    },
  )
}

export {
  addSource,
  createGroup,
  deleteGroup,
  deleteSource,
  fetchAll,
  fetchFeedItem,
  fetchSource,
  getAllContents,
  getBookmarks,
  getConfig,
  getContent,
  initRss,
  markAllRead,
  markRead,
  saveConfig,
  toggleBookmark,
  updateGroup,
  updateSource,
} from './logic'
