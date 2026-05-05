export const DEFAULT_PROVIDER_MODELS: Record<string, string> = {
  ollama: 'gemma4:e4b',
  openai: 'gpt-4o',
  anthropic: 'claude-3-5-sonnet-latest',
  gemini: 'gemini-3-flash-preview',
  deepseek: 'deepseek-v4-flash',
  others: 'gpt-4o',
}

export const DEFAULT_PROVIDER_URLS: Record<string, string> = {
  ollama: 'http://localhost:11434',
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com',
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
  deepseek: 'https://api.deepseek.com',
  others: '',
}

export const TOOL_METADATA: Record<
  string,
  { name: string; description: string }
> = {
  read_file: {
    name: 'Read File',
    description:
      'Read the contents of a file. Useful when you need to understand the logic of a specific file or examine its content for debugging.',
  },
  write_file: {
    name: 'Write File',
    description:
      'Write content to a file. Useful when you need to create new files, update existing code, or save generated data.',
  },
  list_files: {
    name: 'List Files',
    description:
      'List files in a directory. Useful for exploring the project structure and discovering what files are present in a specific folder.',
  },
  run_command: {
    name: 'Run Command',
    description:
      'Execute a shell command. Useful for running build scripts, tests, installing dependencies, or performing system-level operations.',
  },
  grep_search: {
    name: 'Grep Search',
    description:
      'Search for a regex pattern in a specific folder within the workspace. Useful for finding all occurrences of a variable, function, or string across multiple files.',
  },
  read_url: {
    name: 'Read URL',
    description:
      'Fetch and read the content of a URL. Useful for gathering information from external documentation, API references, or public websites.',
  },
  get_file_tree: {
    name: 'Get File Tree',
    description:
      'Get a recursive directory tree of the workspace. Useful for getting a high-level overview of the project structure and folder hierarchy.',
  },
  get_workspace_info: {
    name: 'Get Workspace Info',
    description:
      'Get information about the current workspace environment. Useful at the start of a session to understand the project context, available folders, and the file currently being edited.',
  },
}
