import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Mocks ──────────────────────────────────────────────────────────────

const mockReadJson = vi.hoisted(() => vi.fn())
const mockWriteJson = vi.hoisted(() => vi.fn())
const mockReadText = vi.hoisted(() => vi.fn())
const mockExists = vi.hoisted(() => vi.fn())
const mockCopy = vi.hoisted(() => vi.fn())
const mockJoinPaths = vi.hoisted(() =>
  vi.fn((...parts: string[]) => parts.filter(Boolean).join('/')),
)
const mockGetBasename = vi.hoisted(() =>
  vi.fn((p: string) => p.split('/').pop() || p),
)
const mockGetDirname = vi.hoisted(() =>
  vi.fn((p: string) => p.split('/').slice(0, -1).join('/')),
)
const mockFindFilesRecursively = vi.hoisted(() => vi.fn())
const mockNotifyError = vi.hoisted(() => vi.fn())
const mockYamlLoad = vi.hoisted(() => vi.fn())

vi.mock('../../../src/lib/path', () => ({
  readJson: (...args: unknown[]) => mockReadJson(...args),
  writeJson: (...args: unknown[]) => mockWriteJson(...args),
  readText: (...args: unknown[]) => mockReadText(...args),
  exists: (...args: unknown[]) => mockExists(...args),
  copy: (...args: unknown[]) => mockCopy(...args),
  joinPaths: (...args: string[]) => mockJoinPaths(...args),
  getBasename: (...args: unknown[]) => mockGetBasename(...args),
  getDirname: (...args: unknown[]) => mockGetDirname(...args),
  getMainConfigPath: vi.fn(() => '/mock/.aynite/config/config.json'),
}))

vi.mock('../../../src/main/spells/common', () => ({
  findFilesRecursively: (...args: unknown[]) =>
    mockFindFilesRecursively(...args),
  getBundledResourcesPath: vi.fn(() => '/mock/resources'),
  notifyError: (...args: unknown[]) => mockNotifyError(...args),
}))

vi.mock('js-yaml', async (importOriginal) => {
  const actual = await importOriginal<typeof import('js-yaml')>()
  return {
    ...actual,
    load: (...args: unknown[]) => mockYamlLoad(...args),
  }
})

import {
  getSpellConfig,
  listAvailableSpells,
  restoreDefaultSpells,
  restoreSpell,
  saveSpellConfig,
} from '../../../src/main/spells/spell-installer'

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── getSpellConfig ──────────────────────────────────────────────────────

describe('getSpellConfig', () => {
  it('returns config from main config when key exists', async () => {
    // mainConfig[configKey] = { folders: ['/custom'] }
    mockReadJson.mockResolvedValueOnce({ skills: { folders: ['/custom'] } })
    const result = await getSpellConfig('skills', '/default')
    expect(result).toEqual({ folders: ['/custom'] })
  })

  it('falls back to config file when key missing in main config', async () => {
    mockReadJson
      .mockResolvedValueOnce({}) // main config, no 'skills' key
      .mockResolvedValueOnce({ folders: ['/default'] }) // fallback file
    const result = await getSpellConfig('skills', '/default')
    expect(result).toEqual({ folders: ['/default'] })
  })

  it('falls back on main config read error', async () => {
    mockReadJson
      .mockRejectedValueOnce(new Error('ENOENT')) // main config fails
      .mockResolvedValueOnce({ folders: ['/fallback'] })
    const result = await getSpellConfig('skills', '/fallback')
    expect(result).toEqual({ folders: ['/fallback'] })
  })
})

// ─── saveSpellConfig ─────────────────────────────────────────────────────

describe('saveSpellConfig', () => {
  it('saves config to main config', async () => {
    mockReadJson.mockResolvedValueOnce({ existingKey: 'val' })
    mockWriteJson.mockResolvedValueOnce(undefined)
    await saveSpellConfig('skills', { folders: ['/new'] })
    expect(mockWriteJson).toHaveBeenCalledWith(
      '/mock/.aynite/config/config.json',
      { existingKey: 'val', skills: { folders: ['/new'] } },
    )
  })
})

// ─── listAvailableSpells ─────────────────────────────────────────────────

describe('listAvailableSpells', () => {
  const defaultDir = '/mock/.aynite/skills'

  it('returns empty list when no folders', async () => {
    // getSpellConfig returns mainConfig.skills = { folders: [] }
    mockReadJson.mockResolvedValueOnce({ skills: { folders: [] } })
    const items = await listAvailableSpells(
      'skills',
      defaultDir,
      'SKILL.md',
      false,
    )
    expect(items).toEqual([])
  })

  it('scans folder and parses YAML frontmatter', async () => {
    mockReadJson.mockResolvedValueOnce({ skills: { folders: ['/skills'] } })
    mockExists.mockResolvedValueOnce(true)
    mockFindFilesRecursively.mockResolvedValueOnce([
      '/skills/my-skill/SKILL.md',
    ])
    mockReadText.mockResolvedValueOnce(`---
name: My Skill
description: A test skill
---\n\n# Content here`)
    mockYamlLoad.mockReturnValueOnce({
      name: 'My Skill',
      description: 'A test skill',
    })

    const items = await listAvailableSpells(
      'skills',
      defaultDir,
      'SKILL.md',
      false,
    )
    expect(items).toHaveLength(1)
    expect(items[0].name).toBe('My Skill')
    expect(items[0]).not.toHaveProperty('parameters')
  })

  it('handles YAML parse errors', async () => {
    mockReadJson.mockResolvedValueOnce({ skills: { folders: ['/skills'] } })
    mockExists.mockResolvedValueOnce(true)
    mockFindFilesRecursively.mockResolvedValueOnce([
      '/skills/bad-skill/SKILL.md',
    ])
    mockReadText.mockResolvedValueOnce(`---
invalid: [yaml
---`)

    const items = await listAvailableSpells(
      'skills',
      defaultDir,
      'SKILL.md',
      false,
    )
    expect(items).toHaveLength(1)
    expect(items[0].error).toContain('unexpected end')
    expect(mockNotifyError).toHaveBeenCalled()
  })

  it('deduplicates by name', async () => {
    mockReadJson.mockResolvedValueOnce({
      skills: { folders: ['/skills1', '/skills2'] },
    })
    mockExists.mockResolvedValue(true)
    mockFindFilesRecursively
      .mockResolvedValueOnce(['/skills1/greeter/SKILL.md'])
      .mockResolvedValueOnce(['/skills2/greeter/SKILL.md'])
    mockReadText.mockResolvedValue(`---\nname: greeter\n---`)
    mockYamlLoad.mockReturnValue({ name: 'greeter' })

    const items = await listAvailableSpells(
      'skills',
      defaultDir,
      'SKILL.md',
      false,
    )
    expect(items).toHaveLength(1)
    expect(items[0].name).toBe('greeter')
  })

  it('includes extras when flag is true', async () => {
    mockReadJson.mockResolvedValueOnce({ skills: { folders: ['/skills'] } })
    mockExists.mockResolvedValueOnce(true)
    mockFindFilesRecursively.mockResolvedValueOnce([
      '/skills/my-skill/SKILL.md',
    ])
    mockReadText.mockResolvedValueOnce(`---
name: ParamSkill
parameters:
  - name: input
example: '{"input": "hello"}'
---`)
    mockYamlLoad.mockReturnValueOnce({
      name: 'ParamSkill',
      parameters: [{ name: 'input' }],
      example: '{"input": "hello"}',
    })

    const items = await listAvailableSpells(
      'skills',
      defaultDir,
      'SKILL.md',
      true,
    )
    expect(items[0].parameters).toEqual([{ name: 'input' }])
    expect(items[0].example).toBe('{"input": "hello"}')
  })

  it('skips folder that does not exist', async () => {
    mockReadJson.mockResolvedValueOnce({ skills: { folders: ['/missing'] } })
    mockExists.mockResolvedValueOnce(false)

    const items = await listAvailableSpells(
      'skills',
      defaultDir,
      'SKILL.md',
      false,
    )
    expect(items).toEqual([])
    expect(mockFindFilesRecursively).not.toHaveBeenCalled()
  })
})

// ─── restoreSpell ────────────────────────────────────────────────────────

describe('restoreSpell', () => {
  it('returns true when marker file exists', async () => {
    mockExists.mockResolvedValueOnce(true) // marker exists

    const result = await restoreSpell(
      'skills',
      'test-skill',
      '/dest',
      'SKILL.md',
    )
    expect(result).toBe(true)
    expect(mockCopy).not.toHaveBeenCalled()
  })

  it('copies from bundled resources when no marker arg', async () => {
    // No markerFile arg → short-circuit → only source dir check matters
    mockExists.mockResolvedValueOnce(true) // source dir exists
    mockCopy.mockResolvedValueOnce(undefined)

    const result = await restoreSpell('skills', 'test-skill', '/dest')
    expect(result).toBe(true)
    expect(mockCopy).toHaveBeenCalledWith(
      '/mock/resources/skills/test-skill',
      '/dest',
      { recursive: true },
    )
  })

  it('returns false when source dir does not exist', async () => {
    // No marker → short-circuit → only source dir check
    mockExists.mockResolvedValueOnce(false) // source dir doesn't exist

    const result = await restoreSpell('skills', 'missing', '/dest')
    expect(result).toBe(false)
    expect(mockCopy).not.toHaveBeenCalled()
  })

  it('returns false on copy error', async () => {
    mockExists.mockResolvedValueOnce(true) // source dir exists
    mockCopy.mockRejectedValueOnce(new Error('disk full'))

    const result = await restoreSpell('skills', 'test-skill', '/dest')
    expect(result).toBe(false)
  })
})

// ─── restoreDefaultSpells ────────────────────────────────────────────────

describe('restoreDefaultSpells', () => {
  it('restores all spells successfully', async () => {
    // For skill-a: marker check (skipped) + source exists
    // For skill-b: marker check (skipped) + source exists
    mockExists.mockResolvedValue(true) // all source dirs exist
    mockCopy.mockResolvedValue(undefined)

    const result = await restoreDefaultSpells(
      'skills',
      ['skill-a', 'skill-b'],
      (name: string) => `/dest/${name}`,
    )
    expect(result).toBe(true)
    expect(mockCopy).toHaveBeenCalledTimes(2)
  })

  it('returns false when some spells fail', async () => {
    // skill-a: marker skipped, source exists
    // skill-b: marker skipped, source doesn't exist
    mockExists
      .mockResolvedValueOnce(true) // source skill-a exists
      .mockResolvedValueOnce(false) // source skill-b doesn't exist
    mockCopy.mockResolvedValueOnce(undefined)

    const result = await restoreDefaultSpells(
      'resources',
      ['skill-a', 'skill-b'],
      (name: string) => `/dest/${name}`,
    )
    expect(result).toBe(false)
  })
})
