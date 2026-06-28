import { getIgnoreConfigPath, readText } from '../../lib/path'

export async function getIgnorePatterns(): Promise<string[]> {
  const ignorePath = getIgnoreConfigPath()
  try {
    const content = await readText(ignorePath)
    return content.split('\n').filter((l) => l.trim() !== '')
  } catch {
    return []
  }
}

/**
 * Check if a file/directory name should be ignored based on the ignore patterns.
 *
 * Matching rules:
 * - If a pattern ends with `*`, treat it as a suffix match (e.g. `*.log` matches `error.log`)
 * - Otherwise, do a prefix match: the entry name must equal the pattern or start with it
 *   (e.g. `build` matches `build`, `build-output`, `build_assets`)
 */
export function isFileIgnored(name: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    if (pattern.endsWith('*')) {
      const suffix = pattern.slice(0, -1)
      return name.endsWith(suffix)
    }
    return name === pattern || name.startsWith(pattern)
  })
}
