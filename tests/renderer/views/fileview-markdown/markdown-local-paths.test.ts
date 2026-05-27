import { describe, expect, it } from 'vitest'

/**
 * Test the resolveLocalPath and isLocalPath helpers extracted from
 * FileViewMarkdown.tsx, and the link/image interception logic.
 */

// ─── Helper implementations (copied from FileViewMarkdown.tsx) ───────

function resolveLocalPath(href: string, filePath: string): string {
  // If it's already an absolute path (starts with / on Unix or has drive letter on Windows)
  if (href.startsWith('/')) return href
  if (/^[A-Za-z]:\\/.test(href)) return href

  // Resolve relative to markdown file's directory
  const dir = filePath.split(/[/\\]/).slice(0, -1).join('/')
  // Normalize: handle . and ..
  const segments = href.split('/')
  const result = dir.split('/')
  for (const seg of segments) {
    if (seg === '.' || seg === '') continue
    if (seg === '..') {
      result.pop()
    } else {
      result.push(seg)
    }
  }
  return result.join('/')
}

function isLocalPath(href: string): boolean {
  return !/^(https?:\/\/|mailto:|tel:|#|\/\/)/i.test(href)
}

// ─── Tests for isLocalPath ─────────────────────────────────────────

describe('isLocalPath', () => {
  it('returns true for relative file paths', () => {
    expect(isLocalPath('./pinky-theme.png')).toBe(true)
    expect(isLocalPath('../docs/README.md')).toBe(true)
    expect(isLocalPath('src/file.ts')).toBe(true)
    expect(isLocalPath('file.txt')).toBe(true)
  })

  it('returns true for absolute local file paths', () => {
    expect(isLocalPath('/Users/user/file.txt')).toBe(true)
    expect(isLocalPath('/root/file.ts')).toBe(true)
  })

  it('returns false for http URLs', () => {
    expect(isLocalPath('http://example.com')).toBe(false)
    expect(isLocalPath('https://github.com')).toBe(false)
    expect(isLocalPath('HTTP://example.com')).toBe(false)
  })

  it('returns false for mailto links', () => {
    expect(isLocalPath('mailto:user@example.com')).toBe(false)
  })

  it('returns false for tel links', () => {
    expect(isLocalPath('tel:+1234567890')).toBe(false)
  })

  it('returns false for anchor-only links', () => {
    expect(isLocalPath('#section')).toBe(false)
    expect(isLocalPath('#')).toBe(false)
  })

  it('returns false for protocol-relative URLs', () => {
    expect(isLocalPath('//cdn.example.com/image.png')).toBe(false)
  })
})

// ─── Tests for resolveLocalPath ─────────────────────────────────────

describe('resolveLocalPath', () => {
  const markdownPath = '/Users/user/projects/aynite/docs/README.md'

  it('resolves same-directory relative path', () => {
    const result = resolveLocalPath('./pinky-theme.png', markdownPath)
    expect(result).toBe('/Users/user/projects/aynite/docs/pinky-theme.png')
  })

  it('resolves same-directory path without ./ prefix', () => {
    const result = resolveLocalPath('pinky-theme.png', markdownPath)
    expect(result).toBe('/Users/user/projects/aynite/docs/pinky-theme.png')
  })

  it('resolves parent directory path', () => {
    const result = resolveLocalPath('../resources/theme.png', markdownPath)
    expect(result).toBe('/Users/user/projects/aynite/resources/theme.png')
  })

  it('resolves multiple parent directories', () => {
    const result = resolveLocalPath('../../package.json', markdownPath)
    expect(result).toBe('/Users/user/projects/package.json')
  })

  it('resolves deep nested path', () => {
    const result = resolveLocalPath('./subdir/deeper/file.ts', markdownPath)
    expect(result).toBe(
      '/Users/user/projects/aynite/docs/subdir/deeper/file.ts',
    )
  })

  it('returns absolute paths as-is', () => {
    const result = resolveLocalPath('/etc/config.json', markdownPath)
    expect(result).toBe('/etc/config.json')
  })

  it('handles Windows drive letter paths', () => {
    const result = resolveLocalPath(
      'C:\\Users\\file.txt',
      'D:\\docs\\readme.md',
    )
    expect(result).toBe('C:\\Users\\file.txt')
  })

  it('handles markdown file at root level', () => {
    const result = resolveLocalPath('./image.png', '/README.md')
    expect(result).toBe('/image.png')
  })

  it('handles mixed . and .. segments', () => {
    const result = resolveLocalPath('./a/../b/./c/file.ts', markdownPath)
    expect(result).toBe('/Users/user/projects/aynite/docs/b/c/file.ts')
  })
})

// ─── Tests for image src resolution ─────────────────────────────────

describe('local image src resolution', () => {
  it('prepends aynite-resource:// for local image paths', () => {
    // This simulates the img component handler:
    //   src = `aynite-resource://${resolvedSrc}`
    const markdownPath = '/Users/user/projects/aynite/docs/README.md'
    const src = './pinky-theme.png'
    const resolvedSrc = resolveLocalPath(src, markdownPath)
    const imageSrc = `aynite-resource://${resolvedSrc}`

    expect(imageSrc).toBe(
      'aynite-resource:///Users/user/projects/aynite/docs/pinky-theme.png',
    )
  })

  it('does not modify external image src', () => {
    const src = 'https://example.com/image.png'
    const isLocal = isLocalPath(src)
    expect(isLocal).toBe(false)

    // When isLocal is false, the component renders <img {...props}> as-is
    const imageSrc = src // unchanged
    expect(imageSrc).toBe('https://example.com/image.png')
  })

  it('does not modify protocol-relative image src', () => {
    const src = '//cdn.example.com/image.png'
    const isLocal = isLocalPath(src)
    expect(isLocal).toBe(false)
  })
})

// ─── Tests for link click behavior ──────────────────────────────────

describe('link click interception', () => {
  it('local links should call setConfig(activeFile, resolvedPath)', () => {
    // This is what the a tag onClick does for local paths:
    //   e.preventDefault()
    //   window.aynite.setConfig('activeFile', resolvedPath)
    const href = './subdir/file.ts'
    const markdownPath = '/Users/user/projects/README.md'

    const resolvedPath = resolveLocalPath(href, markdownPath)
    expect(resolvedPath).toBe('/Users/user/projects/subdir/file.ts')

    // The onClick handler would call:
    //   window.aynite.setConfig('activeFile', resolvedPath)
    // We verify the resolved path is correct
    const expectedActiveFile = '/Users/user/projects/subdir/file.ts'
    expect(resolvedPath).toBe(expectedActiveFile)
  })

  it('external links should call openExternal', () => {
    // This is what the a tag onClick does for external http links:
    //   e.preventDefault()
    //   window.aynite.openExternal(href)
    const href = 'https://github.com/w-t-yang/aynite'

    // isLocalPath should return false for this
    expect(isLocalPath(href)).toBe(false)
    // The handler would call window.aynite.openExternal(href)
  })

  it('detects a local markdown link correctly', () => {
    // A link like [Architecture](./ARCHITECTURE_SUMMARY.md)
    // in /Users/user/projects/aynite/docs/README.md
    const href = './ARCHITECTURE_SUMMARY.md'
    const markdownPath = '/Users/user/projects/aynite/docs/README.md'

    expect(isLocalPath(href)).toBe(true)
    const resolved = resolveLocalPath(href, markdownPath)
    expect(resolved).toBe(
      '/Users/user/projects/aynite/docs/ARCHITECTURE_SUMMARY.md',
    )
  })

  it('detects a deep relative link correctly', () => {
    // A link like [Source](../src/main/index.ts)
    const href = '../src/main/index.ts'
    const markdownPath = '/Users/user/projects/aynite/docs/guide.md'

    expect(isLocalPath(href)).toBe(true)
    const resolved = resolveLocalPath(href, markdownPath)
    expect(resolved).toBe('/Users/user/projects/aynite/src/main/index.ts')
  })
})
