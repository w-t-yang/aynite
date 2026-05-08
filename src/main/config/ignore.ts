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
