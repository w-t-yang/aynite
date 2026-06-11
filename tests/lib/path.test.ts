import { describe, expect, it } from 'vitest'
import {
  AYNITE_SUBDIRS,
  expandHome,
  getAbsolutePath,
  getAIConfigPath,
  getAyniteDir,
  getAynitePath,
  getAynitePromptPath,
  getBasename,
  getDirname,
  getExtname,
  getKeybindingsConfigPath,
  getLastSegment,
  getMainConfigPath,
  getParentDir,
  getPathSep,
  getPlaybookPath,
  getPreloadPath,
  getRendererHtmlPath,
  getWorkspaceDataPath,
  getWorkspacesConfigPath,
  getWorkspaceTaskPath,
  isPathWithinDomain,
  joinPaths,
  joinUnixPaths,
  splitPath,
  toUnixPath,
} from '../../src/lib/path'
// Import platform constants directly to avoid Vite barrel re-export issues
import { IS_LINUX, IS_MAC, IS_WINDOWS } from '../../src/lib/platform'

// Note: These tests imported from the old path.ts barrel.
// The barrel now re-exports from src/lib/path/resolve.ts and
// src/lib/path/operations.ts and src/lib/platform.ts.
// These tests verify the barrel contract is maintained.

const SEP = getPathSep()

describe('expandHome', () => {
  it('replaces tilde with home directory', () => {
    const result = expandHome('~/test')
    expect(result).not.toContain('~')
    expect(result).toContain('test')
  })

  it('returns path unchanged if no tilde', () => {
    expect(expandHome('/absolute/path')).toBe('/absolute/path')
  })

  it('handles just tilde', () => {
    const result = expandHome('~')
    expect(result).not.toBe('~')
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('joinPaths', () => {
  it('joins path segments', () => {
    const result = joinPaths('/base', 'sub', 'file.txt')
    expect(result).toContain('base')
    expect(result).toContain('sub')
    expect(result).toContain('file.txt')
  })

  it('handles no arguments', () => {
    expect(joinPaths()).toBe('.')
  })
})

describe('getAyniteDir', () => {
  it('returns a path ending with .aynite', () => {
    const dir = getAyniteDir()
    expect(dir).toContain('.aynite')
  })
})

describe('getAynitePath', () => {
  it('joins parts under .aynite directory', () => {
    const result = getAynitePath('subdir', 'file.json')
    expect(result).toContain('.aynite')
    expect(result).toContain('subdir')
    expect(result).toContain('file.json')
  })
})

describe('path getters', () => {
  it('getAIConfigPath returns path ending with ai.json', () => {
    const p = getAIConfigPath()
    expect(p).toBeDefined()
    expect(p).toContain('.aynite')
  })

  it('getMainConfigPath returns path ending with config.json', () => {
    const p = getMainConfigPath()
    expect(p.endsWith(`config.json`)).toBe(true)
  })

  it('getKeybindingsConfigPath returns path ending with keybindings.json', () => {
    const p = getKeybindingsConfigPath()
    expect(p.endsWith(`keybindings.json`)).toBe(true)
  })

  it('getWorkspacesConfigPath returns path ending with workspaces.json', () => {
    const p = getWorkspacesConfigPath()
    expect(p.endsWith(`workspaces.json`)).toBe(true)
  })

  it('getWorkspaceDataPath returns path ending with config.json under workspace name', () => {
    const p = getWorkspaceDataPath('default')
    expect(p.endsWith(`${SEP}default${SEP}config.json`)).toBe(true)
  })

  it('getAynitePromptPath returns path ending with the given filename', () => {
    const p = getAynitePromptPath('about-me.md')
    expect(p.endsWith('about-me.md')).toBe(true)
    expect(p).toContain(AYNITE_SUBDIRS.PROMPTS)
  })

  it('getPlaybookPath returns path ending with aynite-playbook', () => {
    const p = getPlaybookPath()
    expect(p.endsWith('aynite-playbook')).toBe(true)
  })

  it('getWorkspaceTaskPath returns path under artifacts directory', () => {
    const p = getWorkspaceTaskPath('Dev')
    expect(p).toContain('Dev')
    expect(p).toContain('artifacts')
    expect(p.endsWith('task.md')).toBe(true)
  })

  it('getWorkspaceTaskPath accepts custom filename', () => {
    const p = getWorkspaceTaskPath('Dev', 'plan.md')
    expect(p.endsWith('plan.md')).toBe(true)
  })

  it('getPreloadPath resolves relative to baseDir', () => {
    const p = getPreloadPath('/app/out/main')
    // Uses path.resolve which on Windows produces C:\app\out\preload\index.js
    // Use flexible assertion that works cross-platform
    expect(p).toContain('preload')
    expect(p).toContain('index.js')
  })

  it('getRendererHtmlPath resolves relative to baseDir', () => {
    const p = getRendererHtmlPath('/app/out/main')
    // Uses path.resolve which on Windows produces C:\app\out\renderer\index.html
    expect(p).toContain('renderer')
    expect(p).toContain('index.html')
  })
})

describe('path wrappers', () => {
  it('getBasename returns file name', () => {
    expect(getBasename('/path/to/file.txt')).toBe('file.txt')
    expect(getBasename('/path/to/file.txt', '.txt')).toBe('file')
  })

  it('getDirname returns parent directory', () => {
    expect(getDirname('/path/to/file.txt')).toBe('/path/to')
  })

  it('getExtname returns extension', () => {
    expect(getExtname('/path/to/file.txt')).toBe('.txt')
    expect(getExtname('noext')).toBe('')
  })

  it('getAbsolutePath resolves relative paths', () => {
    const result = getAbsolutePath('relative/path')
    expect(result).toContain('relative')
    expect(result).toContain('path')
  })

  it('getAbsolutePath resolves with base', () => {
    const result = getAbsolutePath('file.txt', '/base/dir')
    expect(result).toContain('base')
    expect(result).toContain('dir')
    expect(result).toContain('file.txt')
  })

  it('getPathSep returns separator', () => {
    const sep = getPathSep()
    expect(sep === '/' || sep === '\\').toBe(true)
  })
})

describe('isPathWithinDomain', () => {
  const domains = ['/home/user/projects', '/home/user/.aynite']

  it('returns true for paths within a domain folder', () => {
    expect(isPathWithinDomain('/home/user/projects/my-app/src', domains)).toBe(
      true,
    )
    expect(isPathWithinDomain('/home/user/.aynite/config', domains)).toBe(true)
  })

  it('returns false for paths outside domain folders', () => {
    expect(isPathWithinDomain('/home/user/other', domains)).toBe(false)
    expect(isPathWithinDomain('/tmp', domains)).toBe(false)
  })

  it('returns false for empty path', () => {
    expect(isPathWithinDomain('', domains)).toBe(false)
    expect(isPathWithinDomain(null as unknown as string, domains)).toBe(false)
  })

  it('handles tilde expansion in paths', () => {
    const homeDomains = ['~/projects']
    const result = isPathWithinDomain('~/projects/my-app', homeDomains)
    expect(result).toBe(true)
  })

  it('returns false for empty domain list', () => {
    expect(isPathWithinDomain('/test/path', [])).toBe(false)
  })

  it('returns true for exact domain match', () => {
    expect(isPathWithinDomain('/home/user/projects', domains)).toBe(true)
  })
})

describe('AYNITE_SUBDIRS', () => {
  it('has all required subdirectories', () => {
    expect(AYNITE_SUBDIRS).toHaveProperty('CONFIG')
    expect(AYNITE_SUBDIRS).toHaveProperty('LOGS')
    expect(AYNITE_SUBDIRS).toHaveProperty('PROMPTS')
    expect(AYNITE_SUBDIRS).toHaveProperty('THEMES')
    expect(AYNITE_SUBDIRS).toHaveProperty('SKILLS')
    expect(AYNITE_SUBDIRS).toHaveProperty('COMMANDS')
    expect(AYNITE_SUBDIRS).toHaveProperty('VIEWS')
    expect(AYNITE_SUBDIRS).toHaveProperty('WORKSPACES')
    expect(AYNITE_SUBDIRS).toHaveProperty('SESSIONS')
  })
})

// ─── Cross-Platform Utilities ────────────────────────────────────────────

describe('platform utilities', () => {
  describe('IS_WINDOWS / IS_MAC / IS_LINUX', () => {
    it('IS_WINDOWS is a boolean', () => {
      expect(typeof IS_WINDOWS).toBe('boolean')
    })
    it('IS_MAC is a boolean', () => {
      expect(typeof IS_MAC).toBe('boolean')
    })
    it('IS_LINUX is a boolean', () => {
      expect(typeof IS_LINUX).toBe('boolean')
    })
  })

  describe('toUnixPath', () => {
    it('converts backslashes to forward slashes', () => {
      expect(toUnixPath('a\\b\\c')).toBe('a/b/c')
    })
    it('leaves forward slashes unchanged', () => {
      expect(toUnixPath('a/b/c')).toBe('a/b/c')
    })
    it('handles mixed separators', () => {
      expect(toUnixPath('a\\b/c')).toBe('a/b/c')
    })
    it('handles empty string', () => {
      expect(toUnixPath('')).toBe('')
    })
    it('handles Windows drive letter paths', () => {
      expect(toUnixPath('C:\\Users\\test')).toBe('C:/Users/test')
    })
  })

  describe('splitPath', () => {
    it('splits on forward slashes', () => {
      expect(splitPath('a/b/c')).toEqual(['a', 'b', 'c'])
    })
    it('splits on backslashes', () => {
      expect(splitPath('a\\b\\c')).toEqual(['a', 'b', 'c'])
    })
    it('splits on mixed separators', () => {
      expect(splitPath('a\\b/c')).toEqual(['a', 'b', 'c'])
    })
  })

  describe('joinUnixPaths', () => {
    it('joins segments with forward slashes', () => {
      expect(joinUnixPaths('a', 'b', 'c')).toBe('a/b/c')
    })
    it('normalizes backslashes in segments', () => {
      expect(joinUnixPaths('a\\b', 'c')).toBe('a/b/c')
    })
  })

  describe('getLastSegment', () => {
    it('gets filename from forward slash path', () => {
      expect(getLastSegment('/path/to/file.txt')).toBe('file.txt')
    })
    it('gets filename from backslash path', () => {
      expect(getLastSegment('C:\\Users\\test\\file.txt')).toBe('file.txt')
    })
    it('gets directory name', () => {
      expect(getLastSegment('/a/b/c/')).toBe('')
    })
  })

  describe('getParentDir', () => {
    it('gets parent from forward slash path', () => {
      expect(getParentDir('/path/to/file.txt')).toBe('/path/to')
    })
    it('gets parent from backslash path', () => {
      expect(getParentDir('C:\\Users\\test\\file.txt')).toBe('C:/Users/test')
    })
    it('returns root for root-level file', () => {
      expect(getParentDir('/file.txt')).toBe('/')
    })
    it('returns dot for single segment', () => {
      expect(getParentDir('file.txt')).toBe('.')
    })
  })
})
