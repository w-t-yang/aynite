import { describe, expect, it, vi } from 'vitest'
import type { FileNode } from '../../../../src/renderer/views/treeview/components'

// The treeview utils are pure functions — test them directly
import {
  fetchFiles,
  findNodeData,
  updateNodeChildren,
} from '../../../../src/renderer/views/treeview/utils'

function createNode(id: string, overrides: Partial<FileNode> = {}): FileNode {
  return {
    id,
    name: id.split('/').pop() || id,
    isDirectory: false,
    isLoaded: false,
    children: undefined,
    ...overrides,
  }
}

describe('findNodeData', () => {
  const tree: FileNode[] = [
    createNode('/root', {
      isDirectory: true,
      children: [
        createNode('/root/src', {
          isDirectory: true,
          children: [
            createNode('/root/src/index.ts'),
            createNode('/root/src/utils.ts'),
          ],
        }),
        createNode('/root/package.json', { isLoaded: true }),
      ],
    }),
  ]

  it('finds a node at root level', () => {
    const result = findNodeData(tree, '/root')
    expect(result).not.toBeNull()
    expect(result?.id).toBe('/root')
    expect(result?.isDirectory).toBe(true)
  })

  it('finds a nested node', () => {
    const result = findNodeData(tree, '/root/src/index.ts')
    expect(result).not.toBeNull()
    expect(result?.id).toBe('/root/src/index.ts')
  })

  it('returns null for non-existent node', () => {
    const result = findNodeData(tree, '/nonexistent')
    expect(result).toBeNull()
  })

  it('returns null for empty array', () => {
    const result = findNodeData([], '/root')
    expect(result).toBeNull()
  })

  it('finds a node with isLoaded flag', () => {
    const result = findNodeData(tree, '/root/package.json')
    expect(result).not.toBeNull()
    expect(result?.isLoaded).toBe(true)
  })
})

describe('updateNodeChildren', () => {
  it('updates children for a target node', () => {
    const tree: FileNode[] = [
      createNode('/root', {
        isDirectory: true,
        children: [createNode('/root/file1.ts')],
      }),
    ]

    const newChildren = [createNode('/root/file2.ts')]
    const updated = updateNodeChildren(tree, '/root', newChildren)

    // Original is not mutated
    expect(tree[0].children).toHaveLength(1)
    expect(tree[0].isLoaded).toBeFalsy()

    // Updated has new children
    const rootNode = updated[0]
    expect(rootNode.children).toHaveLength(1)
    expect(rootNode.children?.[0].id).toBe('/root/file2.ts')
    expect(rootNode.isLoaded).toBe(true)
  })

  it('updates deeply nested children', () => {
    const tree: FileNode[] = [
      createNode('/a', {
        isDirectory: true,
        children: [
          createNode('/a/b', {
            isDirectory: true,
            children: [createNode('/a/b/file.ts')],
          }),
        ],
      }),
    ]

    const newChildren = [createNode('/a/b/new-file.ts')]
    const updated = updateNodeChildren(tree, '/a/b', newChildren)

    const bNode = updated[0].children?.[0]
    expect(bNode.children).toHaveLength(1)
    expect(bNode.children?.[0].id).toBe('/a/b/new-file.ts')
    expect(bNode.isLoaded).toBe(true)
  })

  it('does not modify unrelated branches', () => {
    const tree: FileNode[] = [
      createNode('/a', { isDirectory: true, children: [] }),
      createNode('/b', {
        isDirectory: true,
        children: [createNode('/b/x.ts')],
      }),
    ]

    const updated = updateNodeChildren(tree, '/a', [createNode('/a/y.ts')])

    // /b should be unchanged
    expect(updated[1].children).toHaveLength(1)
    expect(updated[1].children?.[0].id).toBe('/b/x.ts')
  })

  it('returns an empty array for empty input', () => {
    const result = updateNodeChildren([], '/any', [])
    expect(result).toEqual([])
  })
})

describe('fetchFiles', () => {
  it('maps listFolder result to FileNode format', async () => {
    const mockListFolder = vi.fn(() =>
      Promise.resolve([
        { path: '/root/src', name: 'src', isDirectory: true },
        {
          path: '/root/package.json',
          name: 'package.json',
          isDirectory: false,
        },
      ]),
    )
    ;(globalThis as any).window = {
      aynite: { listFolder: mockListFolder },
    }

    const result = await fetchFiles('/root')
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      id: '/root/src',
      name: 'src',
      isDirectory: true,
      isLoaded: false, // directories start unloaded
    })
    expect(Array.isArray(result[0].children)).toBe(true)
    expect(result[1]).toMatchObject({
      id: '/root/package.json',
      name: 'package.json',
      isDirectory: false,
      isLoaded: true, // files are loaded
    })
    expect(result[1].children).toBeUndefined()
    expect(mockListFolder).toHaveBeenCalledWith('/root')
  })

  it('returns empty array on error', async () => {
    const mockListFolder = vi.fn(() =>
      Promise.reject(new Error('access denied')),
    )
    ;(globalThis as any).window = {
      aynite: { listFolder: mockListFolder },
    }

    const result = await fetchFiles('/root')
    expect(result).toEqual([])
  })
})

describe('handleToggle logic (treeData ref pattern)', () => {
  it('only loads children when node exists and is not loaded', () => {
    // Simulates the handleToggle logic
    const treeData: FileNode[] = [
      createNode('/root', {
        isDirectory: true,
        isLoaded: false,
        children: [],
      }),
    ]

    // Simulate: toggle loads children
    const id = '/root'
    const node = findNodeData(treeData, id)
    expect(node).not.toBeNull()
    expect(node?.isLoaded).toBe(false) // should trigger load
    expect(node?.isDirectory).toBe(true)
  })

  it('skips loading when node is already loaded', () => {
    const treeData: FileNode[] = [
      createNode('/root', {
        isDirectory: true,
        isLoaded: true,
        children: [createNode('/root/file.ts')],
      }),
    ]

    const id = '/root'
    const node = findNodeData(treeData, id)
    expect(node).not.toBeNull()
    expect(node?.isLoaded).toBe(true) // skip load — already has children
    expect(node?.children).toHaveLength(1)
  })

  it('skips loading when id does not exist in tree', () => {
    const treeData: FileNode[] = []
    const id = '/nonexistent'
    const node = findNodeData(treeData, id)
    expect(node).toBeNull() // skip load — no node found
  })
})
