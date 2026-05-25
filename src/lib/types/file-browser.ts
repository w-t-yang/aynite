export interface MatchingView {
  name: string
  config: {
    name: string
    description?: string
  }
}

/**
 * Configuration schema for a fileview (e.g., fileview-audio, fileview-image, etc.).
 * Each fileview directory has a config.json that is parsed into this shape.
 */
export interface FileviewConfig {
  name: string
  description: string
  author: string
  version: string
  file_extensions: string[]
  key_bindings: Record<string, unknown>
}
