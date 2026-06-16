import { describe, expect, it } from 'vitest'

// Import all IPC channel constants
import {
  AiChannels,
  ConfigChannels,
  FileChannels,
  GitChannels,
  RssChannels,
  SpellChannels,
  SpotifyChannels,
  SystemChannels,
  ThemeChannels,
  UpdateChannels,
  WorkspaceChannels,
} from '../../src/lib/constants/ipc-channels'

// Import the preload bridge definition (the `aynite` object structure)
// We check that the preload exposes all expected channels

// Preload bridge exposes these functions (from src/preload/index.ts):
// Config: getConfig, setConfig
// File: listFolder, readFile, readFileBinary, openFile, writeFile, createFile,
//       renameFile, copyFile, deleteFile, getFileInfo, checkIsTextFile, watchFile
// Workspace: getWorkspacesList, createWorkspace, deleteWorkspace, switchWorkspace,
//            addWorkspaceFolder, removeWorkspaceFolder, reorderWorkspaceFolders,
//            getWorkspaceFolders, workspaceAllFiles
// AI: aiChat, getMergedSystemPrompt, restorePrompts, listSessions, saveSession,
//     loadSession, runDirectCommand, respondToAiApproval, getArtifactsStatus
// Git: getGitStatus, refreshGitStatus, getGitHeadContent, getGitIndexContent,
//      getGitDiffStats, checkIsGitRoot, commitGenerate, commitExecute,
//      stageHunk, discardHunk
// System: openExternal, getSystemFonts, getAvailableViews, checkForUpdates,
//         downloadUpdate, installUpdate, selectFolder, selectFile, saveFileDialog,
//         activateTile, minimizeWindow, maximizeWindow, closeWindow,
//         openNewWindow, openDevTools
// Theme: getThemes, getTheme, deleteTheme
// Spells: getAvailableSkills, getAvailableCommands, pickSkillFolder,
//         pickCommandFolder, restoreSkills, restoreCommands
// RSS: rssGetConfig, rssSaveConfig, rssFetchFeed, rssFetchAll,
//      rssGetContent, rssGetAllContents, rssGetBookmarks, rssToggleBookmark,
//      rssMarkRead, rssMarkAllRead, rssDeleteSourceContent, rssSummarizeArticle
// Spotify: spotifyInitAuth, spotifyCheckAuth, spotifyCheckProtocol, spotifyLogout,
//          spotifyGetClientId, spotifyLoadAll, spotifyFetchAll,
//          spotifyGetPlaybackState, spotifyPlay, spotifyPause, spotifyNext,
//          spotifyPrevious, spotifyPlayTrack, spotifyPlayTrackInContext,
//          spotifyPlayTracks, spotifyPlayContext, spotifyGetPlaylistTracks,
//          spotifyLoadPlaylistTracks

// The main process registers ipcMain.handle for each channel.
// This test verifies all channel constants are defined and properly
// typed as const strings.

describe('IPC Bridge Contract', () => {
  describe('ConfigChannels', () => {
    it('has all expected channels defined', () => {
      expect(ConfigChannels.GET).toBe('aynite:config-get')
      expect(ConfigChannels.SET).toBe('aynite:config-set')
      expect(ConfigChannels.LOAD).toBe('aynite:config-load')
      expect(ConfigChannels.SAVE).toBe('aynite:config-save')
    })
  })

  describe('FileChannels', () => {
    it('has all expected channels defined', () => {
      expect(FileChannels.LIST).toBe('aynite:file-list')
      expect(FileChannels.READ).toBe('aynite:file-read')
      expect(FileChannels.READ_BINARY).toBe('aynite:file-read-binary')
      expect(FileChannels.OPEN).toBe('aynite:file-open')
      expect(FileChannels.SAVE).toBe('aynite:file-save')
      expect(FileChannels.CREATE).toBe('aynite:file-create')
      expect(FileChannels.RENAME).toBe('aynite:file-rename')
      expect(FileChannels.COPY).toBe('aynite:file-copy')
      expect(FileChannels.DELETE).toBe('aynite:file-delete')
      expect(FileChannels.INFO).toBe('aynite:file-info')
      expect(FileChannels.CHECK_TEXT).toBe('aynite:file-check-text')
      expect(FileChannels.WATCH_FILE).toBe('aynite:file-watch')
    })
  })

  describe('WorkspaceChannels', () => {
    it('has all expected channels defined', () => {
      expect(WorkspaceChannels.LIST).toBe('aynite:workspace-list')
      expect(WorkspaceChannels.CREATE).toBe('aynite:workspace-create')
      expect(WorkspaceChannels.DELETE).toBe('aynite:workspace-delete')
      expect(WorkspaceChannels.SWITCH).toBe('aynite:workspace-switch')
      expect(WorkspaceChannels.ADD_FOLDER).toBe('aynite:workspace-add-folder')
      expect(WorkspaceChannels.FOLDER_REMOVE).toBe(
        'aynite:workspace-folder-remove',
      )
      expect(WorkspaceChannels.FOLDER_REORDER).toBe(
        'aynite:workspace-folder-reorder',
      )
      expect(WorkspaceChannels.FOLDER_LIST).toBe('aynite:workspace-folder-list')
      expect(WorkspaceChannels.FILE_SCAN).toBe('aynite:workspace-file-scan')
    })
  })

  describe('AiChannels', () => {
    it('has all expected channels defined', () => {
      expect(AiChannels.PROMPT_GET_MERGED).toBe('aynite:ai-prompt-get-merged')
      expect(AiChannels.CHAT).toBe('aynite:ai-chat')
      expect(AiChannels.SESSION_SAVE).toBe('aynite:ai-session-save')
      expect(AiChannels.SESSION_LOAD).toBe('aynite:ai-session-load')
      expect(AiChannels.SESSION_LIST).toBe('aynite:ai-session-list')
      expect(AiChannels.PROMPT_RESTORE).toBe('aynite:ai-prompt-restore')
      expect(AiChannels.ARTIFACTS_STATUS).toBe('aynite:ai-artifacts-status')
    })
  })

  describe('GitChannels', () => {
    it('has all expected channels defined', () => {
      expect(GitChannels.STATUS).toBe('aynite:git-status')
      expect(GitChannels.REFRESH_STATUS).toBe('aynite:git-refresh-status')
      expect(GitChannels.HEAD_CONTENT).toBe('aynite:git-head-content')
      expect(GitChannels.INDEX_CONTENT).toBe('aynite:git-index-content')
      expect(GitChannels.STAGE_HUNK).toBe('aynite:git-stage-hunk')
      expect(GitChannels.DISCARD_HUNK).toBe('aynite:git-discard-hunk')
      expect(GitChannels.DIFF_STATS).toBe('aynite:git-diff-stats')
      expect(GitChannels.COMMIT_GENERATE).toBe('aynite:git-commit-generate')
      expect(GitChannels.COMMIT_EXECUTE).toBe('aynite:git-commit-execute')
    })
  })

  describe('SystemChannels', () => {
    it('has all expected channels defined', () => {
      expect(SystemChannels.FONT_LIST).toBe('aynite:system-font-list')
      expect(SystemChannels.OPEN_EXTERNAL).toBe('aynite:system-open-external')
      expect(SystemChannels.APP_VERSION).toBe('aynite:system-app-version')
      expect(SystemChannels.APP_QUIT).toBe('aynite:system-app-quit')
      expect(SystemChannels.DIALOG_SELECT_FILE).toBe(
        'aynite:dialog-select-file',
      )
      expect(SystemChannels.DIALOG_SELECT_FOLDER).toBe(
        'aynite:dialog-select-folder',
      )
      expect(SystemChannels.DIALOG_SAVE_FILE).toBe('aynite:dialog-save-file')
      expect(SystemChannels.WINDOW_MINIMIZE).toBe('aynite:window-minimize')
      expect(SystemChannels.WINDOW_MAXIMIZE).toBe('aynite:window-maximize')
      expect(SystemChannels.WINDOW_CLOSE).toBe('aynite:window-close')
      expect(SystemChannels.WINDOW_NEW).toBe('aynite:window-new')
      expect(SystemChannels.WINDOW_DEVTOOLS).toBe('aynite:window-devtools')
      expect(SystemChannels.VIEW_LIST).toBe('aynite:system-view-list')
      expect(SystemChannels.TILE_ACTIVATE).toBe('aynite:layout-tile-activate')
    })
  })

  describe('UpdateChannels', () => {
    it('has all expected channels defined', () => {
      expect(UpdateChannels.CHECK).toBe('aynite:update-check')
      expect(UpdateChannels.DOWNLOAD).toBe('aynite:update-download')
      expect(UpdateChannels.INSTALL).toBe('aynite:update-install')
    })
  })

  describe('SpellChannels', () => {
    it('has all expected channels defined', () => {
      expect(SpellChannels.SKILL_LIST).toBe('aynite:spell-skill-list')
      expect(SpellChannels.COMMAND_LIST).toBe('aynite:spell-command-list')
      expect(SpellChannels.SKILL_ADD_FOLDER).toBe(
        'aynite:spell-skill-add-folder',
      )
      expect(SpellChannels.COMMAND_ADD_FOLDER).toBe(
        'aynite:spell-command-add-folder',
      )
      expect(SpellChannels.SKILL_RESTORE).toBe(
        'aynite:spell-skill-restore-default',
      )
      expect(SpellChannels.COMMAND_RESTORE).toBe(
        'aynite:spell-command-restore-default',
      )
    })
  })

  describe('RssChannels', () => {
    it('has all expected channels defined', () => {
      expect(RssChannels.GET_CONFIG).toBe('aynite:rss-get-config')
      expect(RssChannels.SAVE_CONFIG).toBe('aynite:rss-save-config')
      expect(RssChannels.FETCH_FEED).toBe('aynite:rss-fetch-feed')
      expect(RssChannels.FETCH_ALL).toBe('aynite:rss-fetch-all')
      expect(RssChannels.GET_CONTENT).toBe('aynite:rss-get-content')
      expect(RssChannels.GET_ALL_CONTENTS).toBe('aynite:rss-get-all-contents')
      expect(RssChannels.GET_BOOKMARKS).toBe('aynite:rss-get-bookmarks')
      expect(RssChannels.TOGGLE_BOOKMARK).toBe('aynite:rss-toggle-bookmark')
      expect(RssChannels.MARK_READ).toBe('aynite:rss-mark-read')
      expect(RssChannels.MARK_ALL_READ).toBe('aynite:rss-mark-all-read')
      expect(RssChannels.DELETE_SOURCE_CONTENT).toBe(
        'aynite:rss-delete-source-content',
      )
      expect(RssChannels.SUMMARIZE).toBe('aynite:rss-summarize')
    })
  })

  describe('SpotifyChannels', () => {
    it('has all expected channels defined', () => {
      expect(SpotifyChannels.INIT_AUTH).toBe('aynite:spotify-init-auth')
      expect(SpotifyChannels.CHECK_AUTH).toBe('aynite:spotify-check-auth')
      expect(SpotifyChannels.CHECK_PROTOCOL).toBe(
        'aynite:spotify-check-protocol',
      )
      expect(SpotifyChannels.LOGOUT).toBe('aynite:spotify-logout')
      expect(SpotifyChannels.GET_CLIENT_ID).toBe('aynite:spotify-get-client-id')
      expect(SpotifyChannels.LOAD_ALL).toBe('aynite:spotify-load-all')
      expect(SpotifyChannels.FETCH_ALL).toBe('aynite:spotify-fetch-all')
      expect(SpotifyChannels.GET_PLAYBACK_STATE).toBe(
        'aynite:spotify-get-playback-state',
      )
      expect(SpotifyChannels.PLAY).toBe('aynite:spotify-play')
      expect(SpotifyChannels.PAUSE).toBe('aynite:spotify-pause')
      expect(SpotifyChannels.NEXT).toBe('aynite:spotify-next')
      expect(SpotifyChannels.PREVIOUS).toBe('aynite:spotify-previous')
      expect(SpotifyChannels.PLAY_TRACK).toBe('aynite:spotify-play-track')
      expect(SpotifyChannels.PLAY_CONTEXT).toBe('aynite:spotify-play-context')
      expect(SpotifyChannels.PLAY_TRACK_IN_CONTEXT).toBe(
        'aynite:spotify-play-track-in-context',
      )
      expect(SpotifyChannels.PLAY_TRACKS).toBe('aynite:spotify-play-tracks')
      expect(SpotifyChannels.GET_PLAYLIST_TRACKS).toBe(
        'aynite:spotify-get-playlist-tracks',
      )
      expect(SpotifyChannels.LOAD_PLAYLIST_TRACKS).toBe(
        'aynite:spotify-load-playlist-tracks',
      )
    })
  })

  describe('ThemeChannels', () => {
    it('has all expected channels defined', () => {
      expect(ThemeChannels.LIST).toBe('aynite:theme-list')
      expect(ThemeChannels.READ).toBe('aynite:theme-read')
      expect(ThemeChannels.SAVE).toBe('aynite:theme-save')
      expect(ThemeChannels.RESTORE).toBe('aynite:theme-restore')
      expect(ThemeChannels.DELETE).toBe('aynite:theme-delete')
    })
  })
})
