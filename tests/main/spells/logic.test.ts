import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Mocks ──────────────────────────────────────────────────────────────

const mockExists = vi.hoisted(() => vi.fn())
const mockReaddir = vi.hoisted(() => vi.fn())
const mockReadJson = vi.hoisted(() => vi.fn())
const mockWriteJson = vi.hoisted(() => vi.fn())
const mockCopy = vi.hoisted(() => vi.fn())
const mockRemove = vi.hoisted(() => vi.fn())

vi.mock('../../../src/lib/path', () => ({
  exists: (...args: unknown[]) => mockExists(...args),
  readdir: (...args: unknown[]) => mockReaddir(...args),
  readJson: (...args: unknown[]) => mockReadJson(...args),
  writeJson: (...args: unknown[]) => mockWriteJson(...args),
  copy: (...args: unknown[]) => mockCopy(...args),
  remove: (...args: unknown[]) => mockRemove(...args),
  getSkillPath: vi.fn((name: string) => `/mock/.aynite/skills/${name}`),
  getSkillsDir: vi.fn(() => '/mock/.aynite/skills'),
  getCommandsDir: vi.fn(() => '/mock/.aynite/commands'),
  getAyniteDir: vi.fn(() => '/mock/.aynite'),
  joinPaths: vi.fn((...parts: string[]) => parts.join('/')),
  getAbsolutePath: vi.fn((p: string, base?: string) =>
    base ? `${base}/${p}` : p,
  ),
}))

vi.mock('../../../src/main/spells/common', () => ({
  getBundledResourcesPath: vi.fn(() => '/mock/resources'),
  findFilesRecursively: vi.fn(() => Promise.resolve([])),
}))

vi.mock('../../../src/main/spells/spell-installer', () => ({
  getSpellConfig: vi.fn((type: string) => {
    if (type === 'skills') {
      return Promise.resolve({ folders: ['/mock/.aynite/skills'] })
    }
    return Promise.resolve({ folders: ['/mock/.aynite/commands'] })
  }),
  saveSpellConfig: vi.fn(() => Promise.resolve()),
  listAvailableSpells: vi.fn(() => Promise.resolve([])),
}))

vi.mock('electron', () => ({
  app: {
    get isPackaged() {
      return false
    },
  },
}))

import {
  getSkillsConfig,
  listAvailableSkills,
  restoreDefaultSkills,
  restoreSkill,
} from '../../../src/main/spells/skills'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('spells/skills', () => {
  describe('getSkillsConfig', () => {
    it('returns skills config with folders', async () => {
      const config = await getSkillsConfig()
      expect(config).toEqual({ folders: ['/mock/.aynite/skills'] })
    })
  })

  describe('listAvailableSkills', () => {
    it('returns empty list when no skills installed', async () => {
      const skills = await listAvailableSkills()
      expect(skills).toEqual([])
    })
  })

  describe('restoreDefaultSkills', () => {
    it('restores default skills from bundled resources', async () => {
      // bundledSkillsDir exists, dest paths do NOT exist (so they need copy)
      mockExists
        .mockResolvedValueOnce(true) // bundledSkillsDir exists
        .mockResolvedValue(false) // all dest paths: not yet copied
      mockReaddir.mockResolvedValue([
        { name: 'create-command', isDirectory: () => true },
        { name: 'create-skill', isDirectory: () => true },
      ])

      const result = await restoreDefaultSkills()

      expect(result).toBe(true)
      expect(mockCopy).toHaveBeenCalled()
    })
  })

  describe('restoreSkill', () => {
    it('restores a single skill from bundled resources', async () => {
      mockExists.mockResolvedValue(true)
      mockReaddir.mockResolvedValue([
        { name: 'my-skill', isDirectory: () => true },
      ])
      mockCopy.mockResolvedValue(undefined)

      const result = await restoreSkill('my-skill')
      expect(result).toBe(true)
      expect(mockCopy).toHaveBeenCalled()
    })

    it('returns false when skill not found in bundle', async () => {
      mockExists.mockResolvedValue(false)

      const result = await restoreSkill('nonexistent-skill')
      expect(result).toBe(false)
    })
  })
})
