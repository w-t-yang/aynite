import {
  AGENT_PROMPTS,
  createDefaultAgentConfig,
  GLOBAL_PROMPTS,
} from '../../lib/constants/ai'
import {
  ensureDir,
  getAynitePromptPath,
  getAynitePromptsDir,
  getMainConfigPath,
  readJson,
  readText,
  writeJson,
  writeText,
} from '../../lib/path'

/**
 * Returns the default full paths for global prompts.
 */
export function getDefaultGlobalPrompts(): string[] {
  return Object.values(GLOBAL_PROMPTS).map((p) =>
    getAynitePromptPath(p.filename),
  )
}

/**
 * Returns the current prompts configuration from config.json or defaults.
 * Now returns the list of files directly.
 */
export async function getPromptsConfig(): Promise<string[]> {
  const config = await readJson(getMainConfigPath())
  return config?.prompts?.files || getDefaultGlobalPrompts()
}

/**
 * Saves the prompts configuration (list of files) to config.json.
 */
export async function savePromptsConfig(files: string[]) {
  const mainConfigPath = getMainConfigPath()
  const config = (await readJson(mainConfigPath)) || {}
  config.prompts = { files }
  await writeJson(mainConfigPath, config)
}

/**
 * Ensures all default prompt files exist in the prompts directory.
 * Does not modify config.json.
 */
export async function ensureDefaultPromptFiles() {
  await ensureDir(getAynitePromptsDir())

  // Write global prompts if they don't exist
  for (const def of Object.values(GLOBAL_PROMPTS)) {
    const p = getAynitePromptPath(def.filename)
    if (!(await exists(p))) {
      await writeText(p, def.content)
    }
  }

  // Write agent prompts if they don't exist
  for (const def of Object.values(AGENT_PROMPTS)) {
    const p = getAynitePromptPath(def.filename)
    if (!(await exists(p))) {
      await writeText(p, def.content)
    }
  }
}

/**
 * Restores all default prompts (global and agent) to the prompts directory
 * AND resets the agents/prompts configuration in config.json.
 */
export async function restoreDefaultPrompts() {
  await ensureDir(getAynitePromptsDir())

  // Force write all prompts
  for (const def of Object.values(GLOBAL_PROMPTS)) {
    await writeText(getAynitePromptPath(def.filename), def.content)
  }
  for (const def of Object.values(AGENT_PROMPTS)) {
    await writeText(getAynitePromptPath(def.filename), def.content)
  }

  const promptFiles = getDefaultGlobalPrompts()
  const agents = createDefaultAgentConfig(getAynitePromptPath)

  // Save to config.json
  const mainConfigPath = getMainConfigPath()
  const config = (await readJson(mainConfigPath)) || {}
  config.prompts = { files: promptFiles }
  config.agents = agents
  await writeJson(mainConfigPath, config)

  return { prompts: { files: promptFiles }, agents }
}

/**
 * Merges the contents of the specified prompt files into a single system prompt.
 */
export async function getMergedSystemPrompt(
  globalFiles?: string[],
  agentFiles?: string[],
) {
  const promptFiles = [
    ...(globalFiles || (await getPromptsConfig())),
    ...(agentFiles || []),
  ]
  let merged = ''

  for (const filePath of promptFiles) {
    const content = await readText(filePath)
    if (content) {
      merged += `${content}\n\n`
    }
  }

  return merged.trim()
}
