// @vitest-environment node
import { describe, expect, it } from 'vitest'

/**
 * Tests for the path computation logic extracted from expandPathIteratively in tree-expand.ts.
 *
 * The function computes a list of paths to open when expanding a tree
 * from root to a target path. The core logic:
 * 1. Find the root that the target path starts with
 * 2. Detect path separator (/ or \)
 * 3. Build intermediate paths from root to target's parent directory
 */

// ─── Extracted pure logic from expandPathIteratively ──────────────────

interface FileNode {
  id: string
  name: string
  isDirectory: boolean
  isLoaded: boolean
  children?: FileNode[]
}

function computePathsToOpen(
  treeData: FileNode[],
  targetPath: string,
): string[] | null {
  if (!treeData.length) return null

  const root = treeData.map((n) => n.id).find((r) => targetPath.startsWith(r))
  if (!root) return null

  const separator = targetPath.includes('\\') ? '\\' : '/'
  const rootParts = root.split(separator)
  const activeParts = targetPath.split(separator)

  const pathsToOpen: string[] = [root]
  let current = root
  for (let i = rootParts.length; i < activeParts.length - 1; i++) {
    current += separator + activeParts[i]
    pathsToOpen.push(current)
  }

  return pathsToOpen
}

// ─── Tests ─────────────────────────────────────────────────────────────

describe('computePathsToOpen', () => {
  const tree: FileNode[] = [
    {
      id: '/root',
      name: 'root',
      isDirectory: true,
      isLoaded: false,
      children: [],
    },
  ]

  it('returns root path when target is root itself', () => {
    const paths = computePathsToOpen(tree, '/root')
    expect(paths).toEqual(['/root'])
  })

  it('builds paths from root to parent of target file', () => {
    const paths = computePathsToOpen(tree, '/root/src/index.ts')
    expect(paths).toEqual(['/root', '/root/src'])
  })

  it('builds deeply nested paths', () => {
    const paths = computePathsToOpen(tree, '/root/a/b/c/d/file.ts')
    expect(paths).toEqual([
      '/root',
      '/root/a',
      '/root/a/b',
      '/root/a/b/c',
      '/root/a/b/c/d',
    ])
  })

  it('handles single-level depth (file in root)', () => {
    const paths = computePathsToOpen(tree, '/root/package.json')
    expect(paths).toEqual(['/root'])
  })

  it('returns null when tree is empty', () => {
    const paths = computePathsToOpen([], '/root/file.ts')
    expect(paths).toBeNull()
  })

  it('returns null when no root matches target', () => {
    const otherTree: FileNode[] = [
      {
        id: '/other',
        name: 'other',
        isDirectory: true,
        isLoaded: false,
        children: [],
      },
    ]
    const paths = computePathsToOpen(otherTree, '/root/file.ts')
    expect(paths).toBeNull()
  })

  it('handles Windows-style backslash paths', () => {
    const winTree: FileNode[] = [
      {
        id: 'C:\\project',
        name: 'project',
        isDirectory: true,
        isLoaded: false,
        children: [],
      },
    ]
    const paths = computePathsToOpen(winTree, 'C:\\project\\src\\index.ts')
    expect(paths).toEqual(['C:\\project', 'C:\\project\\src'])
  })

  it('handles file at the same level as root (no intermediate dirs)', () => {
    const flatTree: FileNode[] = [
      {
        id: '/workspace',
        name: 'workspace',
        isDirectory: true,
        isLoaded: false,
        children: [],
      },
    ]
    const paths = computePathsToOpen(flatTree, '/workspace/file.txt')
    expect(paths).toEqual(['/workspace'])
  })

  it('handles roots that match by prefix', () => {
    // Ensure path matching doesn't confuse /root and /root-other
    const multiTree: FileNode[] = [
      {
        id: '/root-other',
        name: 'root-other',
        isDirectory: true,
        isLoaded: false,
        children: [],
      },
      {
        id: '/root',
        name: 'root',
        isDirectory: true,
        isLoaded: false,
        children: [],
      },
    ]
    const paths = computePathsToOpen(multiTree, '/root/src/file.ts')
    expect(paths).toEqual(['/root', '/root/src'])
  })
})
