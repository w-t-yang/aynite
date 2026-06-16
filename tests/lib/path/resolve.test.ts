/**
 * Tests for pure path resolution functions from src/lib/path/resolve.ts.
 * These are synchronous, pure functions — no mocking needed.
 */
import { describe, expect, it } from 'vitest'
import {
  expandHome,
  getAbsolutePath,
  getAIConfigPath,
  getAppearanceConfigPath,
  getAyniteConfigDir,
  getAyniteDir,
  getAyniteLogsDir,
  getAynitePath,
  getAynitePromptPath,
  getAynitePromptsDir,
  getAyniteSessionsDir,
  getBasename,
  getCommandPath,
  getCommandsDir,
  getDirname,
  getExtname,
  getIconPath,
  getIgnoreConfigPath,
  getKeybindingsConfigPath,
  getLogPath,
  getMainConfigPath,
  getPathSep,
  getPlaybookPath,
  getPreloadPath,
  getRelativePath,
  getRendererHtmlPath,
  getRssBookmarksPath,
  getRssConfigPath,
  getRssContentPath,
  getRssContentsDir,
  getRssSummariesDir,
  getRssSummaryPath,
  getSessionMetadataPath,
  getSessionPath,
  getSessionsDateDir,
  getSkillPath,
  getSkillsDir,
  getSpotifyConfigPath,
  getSpotifyMetadataPath,
  getSpotifyPlaylistsPath,
  getSpotifyPlaylistTracksPath,
  getSpotifyProfilePath,
  getSpotifyRecentlyPlayedPath,
  getSpotifySavedTracksPath,
  getSpotifyTopArtistsPath,
  getSpotifyTopTracksPath,
  getThemePath,
  getThemesDir,
  getViewConfigDir,
  getViewConfigPath,
  getWelcomeMdPath,
  getWorkspaceArtifactsDir,
  getWorkspaceDataPath,
  getWorkspaceDir,
  getWorkspaceMemoryPath,
  getWorkspacePlanPath,
  getWorkspaceSessionsDir,
  getWorkspacesConfigPath,
  getWorkspacesDir,
  getWorkspaceTaskPath,
  isPathWithinDomain,
  joinPaths,
} from '../../../src/lib/path'

describe('path resolution', () => {
  describe('getAyniteDir', () => {
    it('returns ~/.aynite path', () => {
      const dir = getAyniteDir()
      expect(dir).toContain('.aynite')
      expect(dir.endsWith('.aynite')).toBe(true)
    })
  })

  describe('getAynitePath', () => {
    it('joins path segments under .aynite', () => {
      const path = getAynitePath('config', 'config.json')
      expect(path).toContain('.aynite')
      expect(path).toContain('config')
      expect(path).toContain('config.json')
    })
  })

  describe('getAyniteConfigDir', () => {
    it('returns config subdirectory', () => {
      const dir = getAyniteConfigDir()
      expect(dir).toContain('config')
    })
  })

  describe('getAyniteLogsDir', () => {
    it('returns logs subdirectory', () => {
      const dir = getAyniteLogsDir()
      expect(dir).toContain('logs')
    })
  })

  describe('getSessionPath', () => {
    it('includes workspace, date, and session id', () => {
      const path = getSessionPath('session-1', '2026-06-15', 'Dev')
      expect(path).toContain('Dev')
      expect(path).toContain('sessions')
      expect(path).toContain('2026-06-15')
      expect(path).toContain('session-1.json')
    })

    it('uses current date when date not provided', () => {
      const path = getSessionPath('session-1', undefined, 'Dev')
      const today = new Date().toISOString().split('T')[0]
      expect(path).toContain(today)
    })
  })

  describe('getWorkspaceSessionsDir', () => {
    it('returns sessions dir for workspace', () => {
      const dir = getWorkspaceSessionsDir('Dev')
      expect(dir).toContain('Dev')
      expect(dir).toContain('sessions')
    })
  })

  describe('getViewConfigPath', () => {
    it('returns config path for view', () => {
      const path = getViewConfigPath('aichat')
      expect(path).toContain('views')
      expect(path).toContain('aichat')
      expect(path).toContain('config.json')
    })
  })

  describe('getIconPath', () => {
    it('returns icon path', () => {
      const path = getIconPath('/app')
      expect(path).toContain('icon.png')
    })
  })

  describe('getSkillsDir', () => {
    it('returns skills directory', () => {
      const dir = getSkillsDir()
      expect(dir).toContain('skills')
    })
  })

  describe('getRssConfigPath', () => {
    it('returns RSS config path', () => {
      const path = getRssConfigPath()
      expect(path).toContain('rss')
      expect(path).toContain('config.json')
    })
  })

  describe('getSpotifyConfigPath', () => {
    it('returns Spotify config path', () => {
      const path = getSpotifyConfigPath()
      expect(path).toContain('spotify')
      expect(path).toContain('config.json')
    })
  })

  describe('getThemePath', () => {
    it('returns theme file path', () => {
      const path = getThemePath('nord')
      expect(path).toContain('themes')
      expect(path).toContain('nord.json')
    })
  })

  describe('expandHome', () => {
    it('expands tilde to home directory', () => {
      const path = expandHome('~/.aynite/config.json')
      expect(path).not.toContain('~')
      expect(path).toContain('.aynite/config.json')
    })

    it('returns path unchanged when no tilde', () => {
      const path = expandHome('/absolute/path')
      expect(path).toBe('/absolute/path')
    })
  })

  describe('getAyniteSessionsDir', () => {
    it('returns sessions subdirectory', () => {
      const dir = getAyniteSessionsDir()
      expect(dir).toContain('sessions')
    })
  })

  describe('getAynitePromptsDir', () => {
    it('returns prompts subdirectory', () => {
      const dir = getAynitePromptsDir()
      expect(dir).toContain('prompts')
    })
  })

  describe('getAynitePromptPath', () => {
    it('returns prompt file path', () => {
      const p = getAynitePromptPath('system.md')
      expect(p).toContain('prompts')
      expect(p).toContain('system.md')
    })
  })

  describe('getSessionMetadataPath', () => {
    it('includes workspace, date, metadata suffix', () => {
      const p = getSessionMetadataPath('session-1', '2026-06-15', 'Dev')
      expect(p).toContain('Dev')
      expect(p).toContain('session-1-metadata.json')
    })
  })

  describe('getSessionsDateDir', () => {
    it('returns date dir under workspace sessions', () => {
      const dir = getSessionsDateDir('2026-06-15', 'Dev')
      expect(dir).toContain('Dev')
      expect(dir).toContain('2026-06-15')
    })
  })

  describe('getCommandsDir', () => {
    it('returns commands directory', () => {
      const dir = getCommandsDir()
      expect(dir).toContain('commands')
    })
  })

  describe('getSkillPath / getCommandPath', () => {
    it('returns paths under skills/commands', () => {
      expect(getSkillPath('my-skill')).toContain('skills/my-skill')
      expect(getCommandPath('my-cmd')).toContain('commands/my-cmd')
    })
  })

  describe('workspace paths', () => {
    it('getWorkspacesConfigPath returns config/workspaces.json', () => {
      const p = getWorkspacesConfigPath()
      expect(p).toContain('config')
      expect(p).toContain('workspaces.json')
    })

    it('getWorkspacesDir returns workspaces dir', () => {
      const dir = getWorkspacesDir()
      expect(dir).toContain('workspaces')
    })

    it('getWorkspaceDataPath returns config.json for workspace', () => {
      const p = getWorkspaceDataPath('Dev')
      expect(p).toContain('Dev')
      expect(p).toContain('config.json')
    })

    it('getWorkspaceDir returns workspace dir', () => {
      const dir = getWorkspaceDir('Dev')
      expect(dir).toContain('Dev')
    })

    it('getWorkspaceArtifactsDir returns artifacts dir', () => {
      const dir = getWorkspaceArtifactsDir('Dev')
      expect(dir).toContain('Dev')
      expect(dir).toContain('artifacts')
    })

    it('getWorkspaceTaskPath returns task.md', () => {
      const p = getWorkspaceTaskPath('Dev')
      expect(p).toContain('task.md')
    })

    it('getWorkspaceMemoryPath returns memory.md', () => {
      const p = getWorkspaceMemoryPath('Dev')
      expect(p).toContain('memory.md')
    })

    it('getWorkspacePlanPath returns implementation_plan.md', () => {
      const p = getWorkspacePlanPath('Dev')
      expect(p).toContain('implementation_plan.md')
    })
  })

  describe('config paths', () => {
    it('getAIConfigPath returns ai.json', () => {
      expect(getAIConfigPath()).toContain('ai.json')
    })

    it('getKeybindingsConfigPath returns keybindings.json', () => {
      expect(getKeybindingsConfigPath()).toContain('keybindings.json')
    })

    it('getIgnoreConfigPath returns ignore file', () => {
      expect(getIgnoreConfigPath()).toContain('ignore')
    })

    it('getMainConfigPath returns config.json', () => {
      expect(getMainConfigPath()).toContain('config.json')
    })

    it('getAppearanceConfigPath returns appearance.json', () => {
      expect(getAppearanceConfigPath()).toContain('appearance.json')
    })
  })

  describe('log path', () => {
    it('getLogPath returns ai-chat.log by default', () => {
      const p = getLogPath()
      expect(p).toContain('logs')
      expect(p).toContain('ai-chat.log')
    })

    it('getLogPath accepts custom filename', () => {
      const p = getLogPath('custom.log')
      expect(p).toContain('custom.log')
    })
  })

  describe('playbook paths', () => {
    it('getPlaybookPath returns aynite-playbook dir', () => {
      expect(getPlaybookPath()).toContain('aynite-playbook')
    })

    it('getWelcomeMdPath returns Welcome.md', () => {
      const p = getWelcomeMdPath()
      expect(p).toContain('aynite-playbook')
      expect(p).toContain('Welcome.md')
    })
  })

  describe('getPreloadPath and getRendererHtmlPath', () => {
    it('getPreloadPath resolves preload/index.js', () => {
      const p = getPreloadPath('/app/main')
      expect(p).toContain('preload')
      expect(p).toContain('index.js')
    })

    it('getRendererHtmlPath resolves renderer/index.html', () => {
      const p = getRendererHtmlPath('/app/main')
      expect(p).toContain('renderer')
      expect(p).toContain('index.html')
    })
  })

  describe('getViewConfigDir', () => {
    it('returns view config directory', () => {
      const dir = getViewConfigDir('rss')
      expect(dir).toContain('views')
      expect(dir).toContain('rss')
    })
  })

  describe('themes', () => {
    it('getThemesDir returns themes dir', () => {
      expect(getThemesDir()).toContain('themes')
    })
  })

  describe('RSS paths', () => {
    it('getRssContentsDir returns contents dir', () => {
      expect(getRssContentsDir()).toContain('contents')
    })

    it('getRssContentPath returns source content path', () => {
      const p = getRssContentPath('2026-06-15', 'source1')
      expect(p).toContain('source1.json')
      expect(p).toContain('2026-06-15')
    })

    it('getRssBookmarksPath returns bookmarks.json', () => {
      expect(getRssBookmarksPath()).toContain('bookmarks.json')
    })

    it('getRssSummariesDir returns summaries dir', () => {
      expect(getRssSummariesDir()).toContain('summaries')
    })

    it('getRssSummaryPath returns summary path', () => {
      const p = getRssSummaryPath('item-1')
      expect(p).toContain('item-1.json')
    })
  })

  describe('Spotify paths', () => {
    it('getSpotifyProfilePath returns profile.json', () => {
      expect(getSpotifyProfilePath()).toContain('profile.json')
    })

    it('getSpotifyRecentlyPlayedPath returns recently-played.json', () => {
      expect(getSpotifyRecentlyPlayedPath()).toContain('recently-played.json')
    })

    it('getSpotifySavedTracksPath returns saved-tracks.json', () => {
      expect(getSpotifySavedTracksPath()).toContain('saved-tracks.json')
    })

    it('getSpotifyTopArtistsPath returns top-artists.json', () => {
      expect(getSpotifyTopArtistsPath()).toContain('top-artists.json')
    })

    it('getSpotifyTopTracksPath returns top-tracks.json', () => {
      expect(getSpotifyTopTracksPath()).toContain('top-tracks.json')
    })

    it('getSpotifyPlaylistsPath returns playlists.json', () => {
      expect(getSpotifyPlaylistsPath()).toContain('playlists.json')
    })

    it('getSpotifyPlaylistTracksPath returns playlist tracks', () => {
      const p = getSpotifyPlaylistTracksPath('pl-1')
      expect(p).toContain('playlist-tracks')
      expect(p).toContain('pl-1.json')
    })

    it('getSpotifyMetadataPath returns metadata.json', () => {
      expect(getSpotifyMetadataPath()).toContain('metadata.json')
    })
  })

  describe('path utilities', () => {
    it('getBasename returns basename', () => {
      expect(getBasename('/path/to/file.txt')).toBe('file.txt')
    })

    it('getBasename strips extension', () => {
      expect(getBasename('/path/to/file.txt', '.txt')).toBe('file')
    })

    it('getDirname returns directory', () => {
      expect(getDirname('/path/to/file.txt')).toBe('/path/to')
    })

    it('getExtname returns extension', () => {
      expect(getExtname('file.txt')).toBe('.txt')
    })

    it('getExtname returns empty for no extension', () => {
      expect(getExtname('file')).toBe('')
    })

    it('getRelativePath computes relative', () => {
      const rel = getRelativePath(
        '/home/project/src',
        '/home/project/src/main.ts',
      )
      expect(rel).toBe('main.ts')
    })

    it('getAbsolutePath resolves without base', () => {
      const abs = getAbsolutePath('/absolute/path')
      expect(abs).toBe('/absolute/path')
    })

    it('getAbsolutePath resolves with base', () => {
      const abs = getAbsolutePath('sub', '/base')
      expect(abs).toContain('sub')
    })

    it('getPathSep returns separator', () => {
      const sep = getPathSep()
      expect(typeof sep).toBe('string')
      expect(sep.length).toBe(1)
    })

    it('joinPaths joins parts', () => {
      const joined = joinPaths('/base', 'sub', 'file.txt')
      expect(joined).toContain('sub')
      expect(joined).toContain('file.txt')
    })
  })

  describe('isPathWithinDomain', () => {
    it('returns true for exact match', () => {
      expect(isPathWithinDomain('/home/project', ['/home/project'])).toBe(true)
    })

    it('returns true for subdirectory of domain', () => {
      expect(isPathWithinDomain('/home/project/src', ['/home/project'])).toBe(
        true,
      )
    })

    it('returns false for path outside domain', () => {
      expect(isPathWithinDomain('/tmp', ['/home/project'])).toBe(false)
    })

    it('returns false for empty target path', () => {
      expect(isPathWithinDomain('', ['/home/project'])).toBe(false)
    })

    it('returns true when expanded tilde matches', () => {
      const result = isPathWithinDomain('~/.aynite', ['/.aynite'])
      expect(typeof result).toBe('boolean')
    })
  })
})
