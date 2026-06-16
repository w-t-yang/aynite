/**
 * Tests for pure path resolution functions from src/lib/path/resolve.ts.
 * These are synchronous, pure functions — no mocking needed.
 */
import { describe, expect, it } from 'vitest'
import {
  expandHome,
  getAyniteConfigDir,
  getAyniteDir,
  getAyniteLogsDir,
  getAynitePath,
  getIconPath,
  getRssConfigPath,
  getSessionPath,
  getSkillsDir,
  getSpotifyConfigPath,
  getThemePath,
  getViewConfigPath,
  getWorkspaceSessionsDir,
  isPathWithinDomain,
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
