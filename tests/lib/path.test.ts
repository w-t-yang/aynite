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
  getMainConfigPath,
  getPathSep,
  getPlaybookPath,
  getPreloadPath,
  getRendererHtmlPath,
  getWorkspaceDataPath,
  getWorkspacesConfigPath,
  getWorkspaceTaskPath,
  isPathWithinDomain,
  joinPaths,
} from '../../src/lib/path'

// Note: These tests imported from the old path.ts barrel.
// The barrel now re-exports from src/lib/path/resolve.ts and
// src/lib/path/operations.ts. These tests verify the barrel
// contract is maintained.

describe('expandHome', () => {
  it('replaces tilde with home directory', () => {
    const result = expandHome('~/test')
    expect(result).not.toContain('~')
    expect(result).toContain('/test')
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
    expect(result).toBe('/base/sub/file.txt')
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
    expect(result).toContain('subdir/file.json')
  })
})

describe('path getters', () => {
  it('getAIConfigPath returns path ending with ai.json', () => {
    const p = getAIConfigPath()
    expect(p.endsWith('ai.json')).toBe(true)
    expect(p).toContain('.aynite')
  })

  it('getMainConfigPath returns path ending with config.json', () => {
    const p = getMainConfigPath()
    expect(p.endsWith('config.json')).toBe(true)
  })

  it('getKeybindingsConfigPath returns path ending with keybindings.json', () => {
    const p = getKeybindingsConfigPath()
    expect(p.endsWith('keybindings.json')).toBe(true)
  })

  it('getWorkspacesConfigPath returns path ending with workspaces.json', () => {
    const p = getWorkspacesConfigPath()
    expect(p.endsWith('workspaces.json')).toBe(true)
  })

  it('getWorkspaceDataPath returns path ending with config.json under workspace name', () => {
    const p = getWorkspaceDataPath('default')
    expect(p.endsWith('/default/config.json')).toBe(true)
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
    expect(p).toBe('/app/out/preload/index.js')
  })

  it('getRendererHtmlPath resolves relative to baseDir', () => {
    const p = getRendererHtmlPath('/app/out/main')
    expect(p).toBe('/app/out/renderer/index.html')
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
    expect(result).toMatch(/\/relative\/path$/)
  })

  it('getAbsolutePath resolves with base', () => {
    const result = getAbsolutePath('file.txt', '/base/dir')
    expect(result).toBe('/base/dir/file.txt')
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
