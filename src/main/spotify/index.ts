import { ipcMain } from 'electron'
import { SpotifyChannels } from '../../lib/constants/ipc-channels'
import {
  checkAuth,
  fetchAllData,
  fetchPlaylistTracks,
  getPlaybackState,
  getStoredClientId,
  initAuth,
  isStale,
  loadAllFromDisk,
  loadPlaylistTracksFromDisk,
  logout,
  next,
  pause,
  play,
  playContext,
  playTrack,
  playTrackInContext,
  playTracks,
  previous,
} from './logic'

export function setupSpotifyIpc(protocolAvailable: boolean = false) {
  ipcMain.handle(SpotifyChannels.CHECK_PROTOCOL, () => protocolAvailable)

  ipcMain.handle(
    SpotifyChannels.INIT_AUTH,
    async (_event, clientId: string, useProtocol?: boolean) => {
      try {
        const result = await initAuth(
          clientId,
          useProtocol ?? protocolAvailable,
        )
        return result
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        }
      }
    },
  )

  ipcMain.handle(SpotifyChannels.CHECK_AUTH, async () => {
    return checkAuth()
  })

  ipcMain.handle(SpotifyChannels.LOGOUT, async () => {
    try {
      await logout()
      return { success: true }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  })

  ipcMain.handle(SpotifyChannels.GET_CLIENT_ID, async () => {
    return getStoredClientId()
  })

  ipcMain.handle(SpotifyChannels.LOAD_ALL, async () => {
    return loadAllFromDisk()
  })

  ipcMain.handle(SpotifyChannels.FETCH_ALL, async () => {
    try {
      const data = await fetchAllData()
      return { success: true, data }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  })

  ipcMain.handle(SpotifyChannels.GET_PLAYBACK_STATE, async () => {
    return getPlaybackState()
  })

  ipcMain.handle(SpotifyChannels.PLAY, async () => {
    try {
      await play()
      return { success: true }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  })

  ipcMain.handle(SpotifyChannels.PAUSE, async () => {
    try {
      await pause()
      return { success: true }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  })

  ipcMain.handle(SpotifyChannels.NEXT, async () => {
    try {
      await next()
      return { success: true }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  })

  ipcMain.handle(SpotifyChannels.PREVIOUS, async () => {
    try {
      await previous()
      return { success: true }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  })

  ipcMain.handle(SpotifyChannels.PLAY_TRACK, async (_event, uri: string) => {
    try {
      await playTrack(uri)
      return { success: true }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  })

  ipcMain.handle(
    SpotifyChannels.PLAY_TRACK_IN_CONTEXT,
    async (_event, trackUri: string, contextUri: string) => {
      try {
        await playTrackInContext(trackUri, contextUri)
        return { success: true }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        }
      }
    },
  )

  ipcMain.handle(
    SpotifyChannels.PLAY_TRACKS,
    async (_event, trackUris: string[], startUri?: string) => {
      try {
        await playTracks(trackUris, startUri)
        return { success: true }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        }
      }
    },
  )

  ipcMain.handle(SpotifyChannels.PLAY_CONTEXT, async (_event, uri: string) => {
    try {
      await playContext(uri)
      return { success: true }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  })

  ipcMain.handle(
    SpotifyChannels.GET_PLAYLIST_TRACKS,
    async (_event, playlistId: string) => {
      try {
        const tracks = await fetchPlaylistTracks(playlistId)
        return { success: true, data: tracks }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        }
      }
    },
  )

  ipcMain.handle(
    SpotifyChannels.LOAD_PLAYLIST_TRACKS,
    async (_event, playlistId: string) => {
      const tracks = await loadPlaylistTracksFromDisk(playlistId)
      return { success: true, data: tracks }
    },
  )
}

export {
  checkAuth,
  fetchAllData,
  fetchPlaylistTracks,
  getPlaybackState,
  getStoredClientId,
  initAuth,
  isStale,
  loadAllFromDisk,
  loadPlaylistTracksFromDisk,
  logout,
  next,
  pause,
  play,
  playContext,
  playTrack,
  playTrackInContext,
  playTracks,
  previous,
}
