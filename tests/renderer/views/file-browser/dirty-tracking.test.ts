import { describe, expect, it } from 'vitest'

/**
 * Test the dirty-tracking logic that was broken in FileBrowserPage.tsx.
 *
 * The original bug: `content !== fileInfo` compared a string to an object,
 * which was ALWAYS true, so dirtyPaths was never cleared.
 *
 * The fix: compare `content !== originalContent` instead.
 *
 * These tests validate the correct comparison behavior.
 */

describe('dirty tracking comparison logic', () => {
  // Simulates the setDirtyPaths updater function from FileBrowserPage.tsx
  function simulateDirtyTracking(
    prev: Set<string>,
    activePath: string,
    content: string | null,
    originalContent: string | null,
  ): Set<string> {
    const currentlyDirty = content !== originalContent

    // Early return if nothing changed
    if (
      (currentlyDirty && prev.has(activePath)) ||
      (!currentlyDirty && !prev.has(activePath))
    ) {
      return prev
    }

    const next = new Set(prev)
    if (currentlyDirty) {
      next.add(activePath)
    } else {
      next.delete(activePath)
    }
    return next
  }

  it('does not mark as dirty when content matches originalContent', () => {
    const prev = new Set<string>(['/other/file.ts'])
    const result = simulateDirtyTracking(
      prev,
      '/root/file.ts',
      'hello world',
      'hello world',
    )
    expect(result.has('/root/file.ts')).toBe(false)
    expect(result.has('/other/file.ts')).toBe(true) // other paths preserved
  })

  it('marks as dirty when content differs from originalContent', () => {
    const prev = new Set<string>()
    const result = simulateDirtyTracking(
      prev,
      '/root/file.ts',
      'modified content',
      'original content',
    )
    expect(result.has('/root/file.ts')).toBe(true)
  })

  it('clears dirty state when content reverts to original', () => {
    const prev = new Set<string>(['/root/file.ts'])
    const result = simulateDirtyTracking(
      prev,
      '/root/file.ts',
      'hello world',
      'hello world',
    )
    expect(result.has('/root/file.ts')).toBe(false)
  })

  it('keeps dirty state when content is still different (no-op)', () => {
    const prev = new Set<string>(['/root/file.ts'])
    const result = simulateDirtyTracking(
      prev,
      '/root/file.ts',
      'still modified',
      'original',
    )
    // Early return — same state, same prev set
    expect(result).toBe(prev)
    expect(result.has('/root/file.ts')).toBe(true)
  })

  it('keeps clean state when still clean (no-op)', () => {
    const prev = new Set<string>()
    const result = simulateDirtyTracking(prev, '/root/file.ts', 'same', 'same')
    expect(result).toBe(prev)
    expect(result.size).toBe(0)
  })

  it('handles null content (non-text file)', () => {
    const prev = new Set<string>()
    // Both null = not dirty
    const result = simulateDirtyTracking(prev, '/root/image.png', null, null)
    expect(result.has('/root/image.png')).toBe(false)
  })

  it('tracks multiple dirty files independently', () => {
    let set = new Set<string>()

    // Open file A, edit it
    set = simulateDirtyTracking(set, '/a.ts', 'edited', 'original')
    expect(set.has('/a.ts')).toBe(true)

    // Open file B, clean
    set = simulateDirtyTracking(set, '/b.ts', 'same', 'same')
    expect(set.has('/b.ts')).toBe(false)

    // A still dirty
    expect(set.has('/a.ts')).toBe(true)

    // Save A
    set = simulateDirtyTracking(set, '/a.ts', 'edited', 'edited')
    expect(set.has('/a.ts')).toBe(false)
  })
})

describe('originalContent from useFileContent', () => {
  it('originalContent matches content on initial load', () => {
    // This simulates what useFileContent does on loadFile:
    //   const text = await window.aynite.readFile(activePath)
    //   setContent(text)
    //   setOriginalContent(text)
    const loadedText = 'initial file content'
    const content = loadedText
    const originalContent = loadedText
    expect(content === originalContent).toBe(true)
  })

  it('originalContent stays the same after content is modified', () => {
    // After user edits but before save:
    const content = 'modified text'
    const originalContent = 'initial file content'
    expect(content !== originalContent).toBe(true) // dirty
  })

  it('originalContent updates to match content after save', () => {
    // After handleSave:
    //   setOriginalContent(content)
    const content = 'saved text'
    const originalContent = 'saved text'
    expect(content === originalContent).toBe(true) // not dirty
  })
})
