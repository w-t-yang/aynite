/**
 * Bridge module: Spells (Skills & Commands) operations
 *
 * Typed getters and setters for skill and command management.
 */

function getAynite() {
  if (!window.aynite) {
    throw new Error('Aynite bridge not available (not running in Electron?)')
  }
  return window.aynite
}

interface SkillEntry {
  name: string
  description: string
  path: string
  error?: string
}

interface CommandEntry {
  name: string
  description: string
  parameters: any[]
  example: string
  path: string
  error?: string
}

// ── Getters (return data) ────────────────────────────────────────────

export const spells = {
  getAvailableSkills: (): Promise<SkillEntry[]> =>
    getAynite().getAvailableSkills(),

  getAvailableCommands: (): Promise<CommandEntry[]> =>
    getAynite().getAvailableCommands(),
}

// ── Setters (return void) ────────────────────────────────────────────

export const spellsMutations = {
  restoreSkills: (): Promise<boolean> => getAynite().restoreSkills(),

  restoreCommands: (): Promise<boolean> => getAynite().restoreCommands(),

  pickSkillFolder: (): Promise<string | null> => getAynite().pickSkillFolder(),

  pickCommandFolder: (): Promise<string | null> =>
    getAynite().pickCommandFolder(),
}
