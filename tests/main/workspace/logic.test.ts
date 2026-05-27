import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockReadJson = vi.hoisted(() => vi.fn())
const mockWriteJson = vi.hoisted(() => vi.fn())
const mockReaddir = vi.hoisted(() => vi.fn())

vi.mock('../../../src/lib/path', () => ({
  getWorkspacesConfigPath: () => '/mock/.aynite/config/workspaces.json',
  getWorkspaceDataPath: (name: string) =>
    `/mock/.aynite/workspaces/${name}/config.json`,
  getWorkspacesDir: () => '/mock/.aynite/workspaces',
  getPathSep: () => '/',
  joinPaths: (...parts: string[]) => parts.join('/'),
  readJson: (...args: unknown[]) => mockReadJson(...args),
  writeJson: (...args: unknown[]) => mockWriteJson(...args),
  readdir: (...args: unknown[]) => mockReaddir(...args),
}))

import {
  addWorkspaceFolder,
  createWorkspace,
  deleteWorkspace,
  getWorkspaceFolders,
  getWorkspaceState,
  getWorkspacesList,
  removeWorkspaceFolder,
  reorderWorkspaceFolders,
  saveWorkspaceState,
  switchWorkspace,
} from '../../../src/main/workspace/logic'

describe('workspace/logic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getWorkspacesList', () => {
    it('returns the workspaces config', async () => {
      mockReadJson.mockResolvedValue({ active: 'default', list: ['default'] })
      const result = await getWorkspacesList()
      expect(result).toEqual({ active: 'default', list: ['default'] })
    })

    it('returns fallback config if file missing', async () => {
      mockReadJson.mockResolvedValue({
        active: 'Aynite Playbook',
        list: ['Aynite Playbook'],
      })
      const result = await getWorkspacesList()
      expect(result.active).toBeTruthy()
      expect(Array.isArray(result.list)).toBe(true)
    })
  })

  describe('createWorkspace', () => {
    it('creates a new workspace and returns updated config', async () => {
      mockReadJson.mockResolvedValueOnce({
        active: 'default',
        list: ['default'],
      })
      mockWriteJson.mockResolvedValue(undefined)

      const result = await createWorkspace('new-ws')
      expect(result.active).toBe('new-ws')
      expect(result.list).toContain('new-ws')
    })

    it('throws if workspace already exists', async () => {
      mockReadJson.mockResolvedValue({
        active: 'default',
        list: ['default', 'existing'],
      })
      await expect(createWorkspace('existing')).rejects.toThrow(
        'Workspace already exists',
      )
    })
  })

  describe('switchWorkspace', () => {
    it('switches to an existing workspace', async () => {
      mockReadJson.mockResolvedValue({
        active: 'default',
        list: ['default', 'other'],
      })
      mockWriteJson.mockResolvedValue(undefined)

      const result = await switchWorkspace('other')
      expect(result.active).toBe('other')
    })

    it('throws if workspace not found', async () => {
      mockReadJson.mockResolvedValue({ active: 'default', list: ['default'] })
      await expect(switchWorkspace('nonexistent')).rejects.toThrow(
        'Workspace not found',
      )
    })
  })

  describe('getWorkspaceFolders', () => {
    it('returns folders for active workspace', async () => {
      mockReadJson.mockResolvedValueOnce({
        active: 'default',
        list: ['default'],
      })
      mockReadJson.mockResolvedValueOnce({
        id: 'default',
        layouts: [],
        activeLayoutId: '',
        folders: ['/home/project', '/home/other'],
        files: [],
      })

      const result = await getWorkspaceFolders()
      expect(result).toEqual(['/home/project', '/home/other'])
    })

    it('returns empty array if no folders', async () => {
      mockReadJson.mockResolvedValueOnce({
        active: 'default',
        list: ['default'],
      })
      mockReadJson.mockResolvedValueOnce({
        id: 'default',
        layouts: [],
        activeLayoutId: '',
        folders: [],
        files: [],
      })

      const result = await getWorkspaceFolders()
      expect(result).toEqual([])
    })
  })

  describe('getWorkspaceState', () => {
    it('returns workspace config', async () => {
      mockReadJson.mockResolvedValueOnce({
        active: 'default',
        list: ['default'],
      })
      mockReadJson.mockResolvedValueOnce({
        id: 'default',
        layouts: [],
        activeLayoutId: '',
        folders: [],
        files: [],
      })

      const result = await getWorkspaceState()
      expect(result.id).toBe('default')
    })
  })

  describe('addWorkspaceFolder', () => {
    it('adds a folder to the active workspace', async () => {
      mockReadJson.mockResolvedValueOnce({
        active: 'default',
        list: ['default'],
      })
      mockReadJson.mockResolvedValueOnce({
        id: 'default',
        layouts: [],
        activeLayoutId: '',
        folders: [],
        files: [],
      })
      mockWriteJson.mockResolvedValue(undefined)

      const result = await addWorkspaceFolder('/new/folder')
      expect(result).toMatchObject({ success: true, added: '/new/folder' })
    })

    it('does not duplicate existing folders', async () => {
      mockReadJson.mockResolvedValueOnce({
        active: 'default',
        list: ['default'],
      })
      mockReadJson.mockResolvedValueOnce({
        id: 'default',
        layouts: [],
        activeLayoutId: '',
        folders: ['/existing'],
        files: [],
      })
      mockWriteJson.mockResolvedValue(undefined)

      const result = await addWorkspaceFolder('/existing')
      expect(result).toMatchObject({ success: true, reason: 'already_exists' })
      // Should not add duplicate — writeJson should not be called
      expect(mockWriteJson).not.toHaveBeenCalled()
    })
  })

  describe('removeWorkspaceFolder', () => {
    it('removes a folder from the active workspace', async () => {
      mockReadJson.mockResolvedValueOnce({
        active: 'default',
        list: ['default'],
      })
      mockReadJson.mockResolvedValueOnce({
        id: 'default',
        layouts: [],
        activeLayoutId: '',
        folders: ['/keep', '/remove'],
        files: [],
      })
      mockWriteJson.mockResolvedValue(undefined)

      const result = await removeWorkspaceFolder('/remove')
      expect(result).toBe(true)
      const writeCall = mockWriteJson.mock.calls[0]
      expect(writeCall[1].folders).toEqual(['/keep'])
    })
  })

  describe('reorderWorkspaceFolders', () => {
    it('replaces folders with new order', async () => {
      mockReadJson.mockResolvedValueOnce({
        active: 'default',
        list: ['default'],
      })
      mockReadJson.mockResolvedValueOnce({
        id: 'default',
        layouts: [],
        activeLayoutId: '',
        folders: ['/a', '/b', '/c'],
        files: [],
      })
      mockWriteJson.mockResolvedValue(undefined)

      await reorderWorkspaceFolders(['/c', '/a', '/b'])
      const writeCall = mockWriteJson.mock.calls[0]
      expect(writeCall[1].folders).toEqual(['/c', '/a', '/b'])
    })
  })

  describe('saveWorkspaceState', () => {
    it('merges state into existing workspace config', async () => {
      mockReadJson.mockResolvedValueOnce({
        id: 'default',
        layouts: [],
        activeLayoutId: '',
        folders: ['/project'],
        files: [],
      })
      mockWriteJson.mockResolvedValue(undefined)

      await saveWorkspaceState('default', { files: ['file1.ts', 'file2.ts'] })
      const writeCall = mockWriteJson.mock.calls[0]
      expect(writeCall[1]).toMatchObject({
        folders: ['/project'],
        files: ['file1.ts', 'file2.ts'],
      })
    })
  })

  describe('createWorkspace', () => {
    it('sets active to the new workspace', async () => {
      mockReadJson.mockResolvedValueOnce({
        active: 'default',
        list: ['default'],
      })
      mockWriteJson.mockResolvedValue(undefined)

      const result = await createWorkspace('new-ws')
      expect(result.active).toBe('new-ws')
      expect(result.list).toContain('new-ws')
    })
  })

  describe('deleteWorkspace', () => {
    it('removes workspace from list', async () => {
      mockReadJson.mockResolvedValueOnce({
        active: 'ws2',
        list: ['ws1', 'ws2', 'ws3'],
      })
      mockWriteJson.mockResolvedValue(undefined)

      const result = await deleteWorkspace('ws1')
      expect(result.list).toEqual(['ws2', 'ws3'])
    })

    it('switches active to first remaining workspace when deleting active', async () => {
      mockReadJson.mockResolvedValueOnce({
        active: 'ws1',
        list: ['ws1', 'ws2'],
      })
      mockWriteJson.mockResolvedValue(undefined)

      const result = await deleteWorkspace('ws1')
      expect(result.active).toBe('ws2')
    })

    it('throws when trying to delete the last workspace', async () => {
      mockReadJson.mockResolvedValueOnce({
        active: 'only',
        list: ['only'],
      })

      await expect(deleteWorkspace('only')).rejects.toThrow(
        'Cannot delete the last workspace',
      )
    })
  })
})
