import {
  AGENT_PROMPTS,
  GLOBAL_PROMPTS,
  createDefaultAgentConfig,
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
 * Restores all default prompts (global and agent) to the prompts directory
 * and initializes the agents in config.json.
 */
export async function restoreDefaultPrompts() {
  await ensureDir(getAynitePromptsDir())

  // Write all global prompts
  for (const def of Object.values(GLOBAL_PROMPTS)) {
    await writeText(getAynitePromptPath(def.filename), def.content)
  }

  // Write all agent prompts
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
