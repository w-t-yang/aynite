import { exists, getIgnoreConfigPath, readText } from '../../lib/path'

export async function getIgnorePatterns(): Promise<string[]> {
  const ignorePath = getIgnoreConfigPath()
  try {
    if (!(await exists(ignorePath))) return ['.git', 'node_modules']
    const data = await readText(ignorePath)
    return data
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
  } catch {
    return ['.git', 'node_modules']
  }
}
