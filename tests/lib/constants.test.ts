import { describe, expect, it } from 'vitest'
import {
  AGENT_PROMPTS,
  DEFAULT_AGENTS,
  DEFAULT_AI_CONFIG,
  DEFAULT_AI_TOOLS,
  GLOBAL_PROMPTS,
  TOOL_METADATA,
} from '../../src/lib/constants/ai'
import { AppOperation, ViewOperation } from '../../src/lib/constants/app'
import { ConfigKey } from '../../src/lib/constants/config'
import { DEFAULT_KEYBINDINGS } from '../../src/lib/constants/keybindings'
import { ERROR_MESSAGES } from '../../src/lib/constants/messages'
import { DEFAULT_SETTINGS } from '../../src/lib/constants/settings'
import { DEFAULT_THEMES } from '../../src/lib/constants/themes'
// view.ts module was removed — these types now live elsewhere or are unused
import { DEFAULT_WORKSPACE_CONFIG } from '../../src/lib/constants/workspace'

describe('ConfigKey', () => {
  it('has required keys', () => {
    expect(ConfigKey.WORKSPACES).toBe('workspaces')
    expect(ConfigKey.ACTIVE_WORKSPACE).toBe('activeWorkspace')
    expect(ConfigKey.KEYBINDINGS).toBe('keybindings')
    expect(ConfigKey.AI).toBe('ai')
    expect(ConfigKey.THEMES).toBe('themes')
    expect(ConfigKey.VERSION).toBe('version')
  })

  it('all keys are non-empty strings', () => {
    const keys = Object.values(ConfigKey)
    keys.forEach((key) => {
      expect(typeof key).toBe('string')
      expect(key.length).toBeGreaterThan(0)
    })
  })
})

describe('Default workspace config', () => {
  it('DEFAULT_WORKSPACE_CONFIG id is set', () => {
    expect(DEFAULT_WORKSPACE_CONFIG.id).toBe('Aynite')
  })

  it('DEFAULT_WORKSPACE_CONFIG has correct structure', () => {
    expect(DEFAULT_WORKSPACE_CONFIG.layouts.length).toBeGreaterThan(0)
    expect(DEFAULT_WORKSPACE_CONFIG.activeLayoutId).toBe('aynite-default')
    expect(DEFAULT_WORKSPACE_CONFIG.folders).toEqual([])
    expect(DEFAULT_WORKSPACE_CONFIG.files).toEqual([])
  })
})

describe('AI constants', () => {
  it('DEFAULT_AI_CONFIG has expected structure', () => {
    // activeId is intentionally empty — filled at runtime from user config
    expect(DEFAULT_AI_CONFIG).toHaveProperty('activeId')
    expect(DEFAULT_AI_CONFIG).toHaveProperty('providers')
    expect(Array.isArray(DEFAULT_AI_CONFIG.providers)).toBe(true)
  })

  it('DEFAULT_AGENTS includes all expected agents', () => {
    const agentIds = DEFAULT_AGENTS.map((a) => a.id)
    expect(agentIds).toContain('aynite')
    expect(agentIds).toContain('void')
    expect(agentIds).toContain('alpha')
  })

  it('GLOBAL_PROMPTS has required keys', () => {
    expect(GLOBAL_PROMPTS).toHaveProperty('ME')
    expect(GLOBAL_PROMPTS).toHaveProperty('SKILLS')
    expect(GLOBAL_PROMPTS).toHaveProperty('COMMANDS')
    expect(GLOBAL_PROMPTS).toHaveProperty('FILES')
  })

  it('AGENT_PROMPTS has required keys', () => {
    expect(AGENT_PROMPTS).toHaveProperty('AYNITE')
    expect(AGENT_PROMPTS).toHaveProperty('VOID')
    expect(AGENT_PROMPTS).toHaveProperty('ALPHA')
  })

  it('TOOL_METADATA has all required tools', () => {
    const toolIds = Object.keys(TOOL_METADATA)
    expect(toolIds).toContain('read_file')
    expect(toolIds).toContain('write_file')
    expect(toolIds).toContain('run_command')
    expect(toolIds).toContain('grep_search')
  })

  it('TOOL_METADATA tools have correct shape', () => {
    for (const [_id, tool] of Object.entries(TOOL_METADATA)) {
      expect(tool.name).toBeTruthy()
      expect(tool.description).toBeTruthy()
      expect(tool.inputSchema).toBeTruthy()
      expect(tool.inputSchema.type).toBe('object')
    }
  })

  it('DEFAULT_AI_TOOLS has all tools enabled', () => {
    expect(Object.keys(DEFAULT_AI_TOOLS).length).toBe(
      Object.keys(TOOL_METADATA).length,
    )
    for (const key of Object.keys(TOOL_METADATA)) {
      expect(DEFAULT_AI_TOOLS[key]).toBe(true)
    }
  })
})

describe('Theme constants', () => {
  it('has at least light and dark themes', () => {
    expect(DEFAULT_THEMES).toHaveProperty('light')
    expect(DEFAULT_THEMES).toHaveProperty('dark')
  })

  it('themes have required fields', () => {
    for (const [_id, theme] of Object.entries(DEFAULT_THEMES)) {
      expect(theme.name).toBeTruthy()
      expect(theme.type).toMatch(/^(light|dark)$/)
      expect(theme.colors).toBeTruthy()
      expect(typeof theme.colors).toBe('object')
      expect(theme.colors.background).toBeTruthy()
    }
  })
})

// View protocol describe block removed — src/lib/constants/view.ts no longer exists

describe('AppOperation', () => {
  it('has all expected operations', () => {
    expect(AppOperation.TILE_CYCLE).toBe('TILE_CYCLE')
    expect(AppOperation.TILE_SPLIT_VERTICAL).toBe('TILE_SPLIT_VERTICAL')
    expect(AppOperation.TILE_CLOSE).toBe('TILE_CLOSE')
    expect(AppOperation.QUIT).toBe('QUIT')
    expect(AppOperation.FOCUS_CHAT).toBe('FOCUS_CHAT')
    expect(AppOperation.REFRESH_TILE).toBe('REFRESH_TILE')
  })

  it('all values are non-empty strings', () => {
    const values = Object.values(AppOperation)
    values.forEach((v) => {
      expect(typeof v).toBe('string')
      expect(v.length).toBeGreaterThan(0)
    })
  })
})

describe('ViewOperation', () => {
  it('has expected operations', () => {
    expect(ViewOperation.COPY).toBe('COPY')
    expect(ViewOperation.PASTE).toBe('PASTE')
    expect(ViewOperation.CUT).toBe('CUT')
    expect(ViewOperation.KEYBOARD_QUIT).toBe('KEYBOARD_QUIT')
    expect(ViewOperation.REFRESH).toBe('REFRESH')
  })

  it('all values are non-empty strings', () => {
    const values = Object.values(ViewOperation)
    values.forEach((v) => {
      expect(typeof v).toBe('string')
      expect(v.length).toBeGreaterThan(0)
    })
  })
})

describe('DEFAULT_KEYBINDINGS', () => {
  it('has app and view sections', () => {
    expect(DEFAULT_KEYBINDINGS).toHaveProperty('app')
    expect(DEFAULT_KEYBINDINGS).toHaveProperty('view')
  })

  it('app keybindings have required structure', () => {
    const { app } = DEFAULT_KEYBINDINGS
    expect(app).toHaveProperty(AppOperation.TILE_CYCLE)
    expect(app[AppOperation.TILE_CYCLE]).toMatchObject({
      ctrl: true,
      key: expect.any(String),
    })
    // QUIT was removed from default keybindings — it's handled by the OS
    expect(app).not.toHaveProperty(AppOperation.QUIT)
  })

  it('view keybindings have required structure', () => {
    const { view } = DEFAULT_KEYBINDINGS
    expect(view).toHaveProperty(ViewOperation.COPY)
    expect(view[ViewOperation.COPY]).toMatchObject({ ctrl: true, key: 'c' })
    expect(view).toHaveProperty(ViewOperation.KEYBOARD_QUIT)
    expect(view[ViewOperation.KEYBOARD_QUIT]).toMatchObject({ key: 'escape' })
  })

  it('all binding values have valid structure', () => {
    for (const section of Object.values(DEFAULT_KEYBINDINGS)) {
      for (const binding of Object.values(section)) {
        expect(typeof binding).toBe('object')
        expect(binding).not.toBeNull()
        expect(typeof binding.key).toBe('string')
        expect(binding.key.length).toBeGreaterThan(0)
      }
    }
  })
})

describe('DEFAULT_SETTINGS', () => {
  it('has all required sections', () => {
    expect(DEFAULT_SETTINGS).toHaveProperty('activeTheme')
    expect(DEFAULT_SETTINGS).toHaveProperty('ai')
    expect(DEFAULT_SETTINGS).toHaveProperty('keybindings')
    expect(DEFAULT_SETTINGS).toHaveProperty('prompts')
    expect(DEFAULT_SETTINGS).toHaveProperty('aiTools')
    expect(DEFAULT_SETTINGS).toHaveProperty('agents')
  })

  it('has a default theme set', () => {
    expect(typeof DEFAULT_SETTINGS.activeTheme).toBe('string')
    expect(DEFAULT_SETTINGS.activeTheme.length).toBeGreaterThan(0)
  })

  it('ai config is the default', () => {
    expect(DEFAULT_SETTINGS.ai).toBe(DEFAULT_AI_CONFIG)
  })
})

describe('ERROR_MESSAGES', () => {
  it('has all required message factories', () => {
    expect(typeof ERROR_MESSAGES.ACCESS_DENIED).toBe('function')
    expect(typeof ERROR_MESSAGES.FILE_READ_ERROR).toBe('function')
    expect(typeof ERROR_MESSAGES.FILE_WRITE_SUCCESS).toBe('function')
    expect(typeof ERROR_MESSAGES.COMMAND_EXEC_ERROR).toBe('function')
    expect(typeof ERROR_MESSAGES.NO_MATCHES_FOUND).toBe('string')
    expect(typeof ERROR_MESSAGES.DIR_EMPTY).toBe('string')
  })

  it('ACCESS_DENIED formats path correctly', () => {
    const msg = ERROR_MESSAGES.ACCESS_DENIED('/etc/passwd')
    expect(msg).toContain('/etc/passwd')
    expect(msg).toContain('Access denied')
  })

  it('FILE_READ_ERROR includes error message', () => {
    const msg = ERROR_MESSAGES.FILE_READ_ERROR('ENOENT: no such file')
    expect(msg).toContain('ENOENT')
  })

  it('COMMAND_EXEC_ERROR formats all parts', () => {
    const msg = ERROR_MESSAGES.COMMAND_EXEC_ERROR(
      'timeout',
      'stdout data',
      'stderr data',
    )
    expect(msg).toContain('timeout')
    expect(msg).toContain('stdout data')
    expect(msg).toContain('stderr data')
  })
})
