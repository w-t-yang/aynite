/**
 * Provider options that disable reasoning/thinking for all supported providers.
 * Use this for simple tasks (summarization, commit messages, etc.) where
 * reasoning is unnecessary and only adds latency + cost.
 */
export const DISABLED_REASONING_OPTIONS: Record<string, any> = {
  anthropic: { thinking: { type: 'disabled' } },
  deepseek: { thinking: { type: 'disabled' } },
  google: { thinkingConfig: { thinkingLevel: 'minimal' } },
  openai: { reasoning_effort: null },
}

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

export type ToolGroup = 'os' | 'web' | 'project' | 'messenger' | 'flow'

/** Tool groups that are automatically managed (never shown in agent settings). */
export const SYSTEM_TOOL_GROUPS: ToolGroup[] = ['messenger', 'flow']

export const TOOL_METADATA: Record<
  string,
  {
    name: string
    description: string
    group: ToolGroup
    inputSchema: Record<string, unknown>
  }
> = {
  read_file: {
    name: 'Read File',
    description:
      'Read the contents of a file. Useful when you need to understand the logic of a specific file or examine its content for debugging.',
    group: 'os',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path to the file' },
      },
      required: ['path'],
    },
  },
  write_file: {
    name: 'Write File',
    description:
      'Write content to a file. Useful when you need to create new files, update existing code, or save generated data.',
    group: 'os',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path to the file' },
        content: { type: 'string', description: 'Content to write' },
      },
      required: ['path', 'content'],
    },
  },
  edit_file: {
    name: 'Edit File',
    description:
      'Perform a surgical edit on a file by replacing a specific block of code. This is the preferred way to modify existing files as it is faster and more reliable than rewriting the whole file.',
    group: 'os',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path to the file' },
        targetContent: {
          type: 'string',
          description: 'The exact block of code you want to replace',
        },
        replacementContent: {
          type: 'string',
          description: 'The new code to replace the target block with',
        },
      },
      required: ['path', 'targetContent', 'replacementContent'],
    },
  },
  list_files: {
    name: 'List Files',
    description:
      'List files in a directory. Useful for exploring the project structure and discovering what files are present in a specific folder.',
    group: 'os',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path to the directory' },
      },
      required: ['path'],
    },
  },
  run_command: {
    name: 'Run Command',
    description:
      'Execute a shell command. Automatically runs in the project workspace directory - do NOT prefix with `cd`. Use the optional `cwd` parameter only if you need a different directory.',
    group: 'os',
    inputSchema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The shell command (do not prefix with cd)',
        },
        cwd: {
          type: 'string',
          description:
            'Optional directory to run in (defaults to workspace root)',
        },
      },
      required: ['command'],
    },
  },
  grep_search: {
    name: 'Grep Search',
    description:
      'Search for a regex pattern in a specific folder within the workspace. Useful for finding all occurrences of a variable, function, or string across multiple files.',
    group: 'os',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Regex pattern to search for' },
        folderPath: {
          type: 'string',
          description: 'The absolute path to the directory to search within',
        },
        include: {
          type: 'string',
          description: 'Optional glob pattern for files to include',
        },
      },
      required: ['pattern', 'folderPath'],
    },
  },
  read_url: {
    name: 'Read URL',
    description:
      'Fetch and read the content of a URL. Useful for gathering information from external documentation, API references, or public websites.',
    group: 'web',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The URL to fetch' },
      },
      required: ['url'],
    },
  },
  glob_search: {
    name: 'Glob Search',
    description:
      'Search for files matching a glob pattern across the workspace. Useful for finding files by extension or naming convention (e.g., "**/*.test.ts").',
    group: 'os',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Glob pattern (e.g., "src/**/*.css")',
        },
        cwd: {
          type: 'string',
          description: 'Optional directory to start the search from',
        },
      },
      required: ['pattern'],
    },
  },
  create_task: {
    name: 'Create Task',
    description:
      'Initialize a new task list or implementation plan in the workspace artifacts directory. Use this at the start of complex operations to track goals.',
    group: 'project',
    inputSchema: {
      type: 'object',
      properties: {
        tasks: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of task items to initialize',
        },
        filename: {
          type: 'string',
          description: 'Optional filename (defaults to task.md)',
        },
      },
      required: ['tasks'],
    },
  },
  update_task: {
    name: 'Update Task',
    description:
      'Update the status of tasks in the task list. Use this to mark items as completed or add new sub-tasks as you progress.',
    group: 'project',
    inputSchema: {
      type: 'object',
      properties: {
        taskIndex: {
          type: 'number',
          description: 'The index of the task to update (0-based)',
        },
        status: {
          type: 'string',
          enum: ['todo', 'in_progress', 'done'],
          description: 'New status for the task',
        },
        filename: {
          type: 'string',
          description: 'Optional filename (defaults to task.md)',
        },
      },
      required: ['taskIndex', 'status'],
    },
  },
  get_tasks: {
    name: 'Get Tasks',
    description:
      'Read the current task list from the workspace artifacts directory.',
    group: 'project',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Optional filename (defaults to task.md)',
        },
      },
    },
  },
  propose_plan: {
    name: 'Propose Plan',
    description:
      'Create a detailed implementation plan in the workspace artifacts directory. This is MANDATORY for complex tasks and must be approved by the user before execution starts.',
    group: 'project',
    inputSchema: {
      type: 'object',
      properties: {
        problemStatement: {
          type: 'string',
          description: 'Detailed description of the problem to be solved',
        },
        investigationResults: {
          type: 'string',
          description:
            'Findings from exploring the workspace (files, components, logic)',
        },
        proposedArchitecture: {
          type: 'string',
          description: 'High-level technical approach and trade-offs',
        },
        implementationSteps: {
          type: 'array',
          items: { type: 'string' },
          description: 'Step-by-step breakdown of surgical edits to be made',
        },
        verificationPlan: {
          type: 'string',
          description: 'How the changes will be verified',
        },
        openQuestions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Anything still uncertain or requiring user feedback',
        },
      },
      required: [
        'problemStatement',
        'investigationResults',
        'proposedArchitecture',
        'implementationSteps',
        'verificationPlan',
      ],
    },
  },
  update_memory: {
    name: 'Update Memory',
    description:
      'Update the project memory with new architectural decisions, learned patterns, or important context. Use this to ensure future AI sessions understand the current state of the project.',
    group: 'project',
    inputSchema: {
      type: 'object',
      properties: {
        update: {
          type: 'string',
          description: 'The information to add or update in memory.md',
        },
      },
      required: ['update'],
    },
  },
  read_memory: {
    name: 'Read Memory',
    description:
      'Read the project memory (memory.md) to understand architecture, naming conventions, and previous decisions.',
    group: 'project',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  get_file_tree: {
    name: 'Get File Tree',
    description:
      'Get a recursive directory tree of the workspace. Useful for getting a high-level overview of the project structure and folder hierarchy.',
    group: 'project',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Starting directory (optional)' },
        depth: { type: 'number', description: 'Max depth (default 10)' },
      },
    },
  },
  get_workspace_info: {
    name: 'Get Workspace Info',
    description:
      'Get information about the current workspace environment. Useful at the start of a session to understand the project context, available folders, and the file currently being edited.',
    group: 'project',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  get_messages: {
    name: 'Get Messages',
    description:
      'Fetch recent messages from the chat history. Use this when you need to understand context from earlier conversation, especially in group chats where users discuss topics before asking you to take action (e.g. summarizing notes, creating todos). Only messages from the current channel are accessible. After reading history, you MUST ask the user to confirm whether you understood the context correctly.',
    group: 'messenger',
    inputSchema: {
      type: 'object',
      properties: {
        count: {
          type: 'number',
          description:
            'Number of recent messages to fetch (default 10, max 50)',
        },
        since: {
          type: 'string',
          description:
            'Optional ISO date string to fetch messages from a specific date (e.g. "2026-06-20"). If omitted, fetches from today.',
        },
      },
    },
  },
  notify_user: {
    name: 'Notify User',
    description:
      'Send a message to the user in the current chat. Use this when you cannot answer immediately and need time to work (e.g. running commands, researching). Reply directly when you can answer right away; use this tool only to acknowledge requests that require longer processing.',
    group: 'messenger',
    inputSchema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The message to send to the user',
        },
      },
      required: ['message'],
    },
  },
  create_steps: {
    name: 'Create Steps',
    description:
      'Create a list of steps for executing a flow. Each step contains an instruction for the AI to follow. Steps are executed sequentially.',
    group: 'flow',
    inputSchema: {
      type: 'object',
      properties: {
        flowId: {
          type: 'string',
          description: 'The ID of the flow to add steps to',
        },
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              userInstruction: {
                type: 'string',
                description: 'The instruction for this step',
              },
            },
            required: ['userInstruction'],
          },
          description: 'The list of steps to create',
        },
      },
      required: ['flowId', 'steps'],
    },
  },
}

export const DEFAULT_AI_TOOLS: Record<string, boolean> = Object.keys(
  TOOL_METADATA,
).reduce(
  (acc, key) => {
    acc[key] = true
    return acc
  },
  {} as Record<string, boolean>,
)

export const DEFAULT_AI_CONFIG = {
  activeId: '',
  providers: [],
}

import type { PromptDefinition } from '../types/ai'

export type { PromptDefinition }

export const GLOBAL_PROMPTS: Record<string, PromptDefinition> = {
  ME: {
    filename: 'about-me.md',
    content: `# About Me
You are Aynite, an AI assistant.`,
  },
  SKILLS: {
    filename: 'about-skills.md',
    content: `# About Skills
You can use specialized 'skills' to help you with complex tasks. Each skill is a directory containing a SKILL.md file with instructions.
When the user mentions a skill in the format \`/skill[name](path)\`, it means the skill located at \`path\` is active. You should use your tools to read the \`SKILL.md\` file within that directory to understand its specific rules and capabilities.`,
  },
  COMMANDS: {
    filename: 'about-commands.md',
    content: `# About Commands
You can run terminal commands on the USER's system. Always ensure commands are safe and explain what they do.
Commands run automatically in the project workspace directory, so do NOT prefix them with \`cd /path/to/project\`.
When the user mentions a command in the format \`>cmd[name](path)\`, it is executed DIRECTLY by the application before your turn. You will see the results of these commands in the chat history as tool messages.
Do not attempt to execute these commands yourself using tools; they are handled by the environment.

# About Using the \`run_command\` Tool
The \`run_command\` tool has a \`cwd\` parameter that defaults to the workspace root. Do NOT include \`cd\` in the command string - just write the command directly. Use the \`cwd\` parameter only if you explicitly need a different directory.`,
  },
  FILES: {
    filename: 'about-files.md',
    content: `# About Files
You have access to the local filesystem. You can read, create, and modify files within the allowed workspace.
The user can mention files or directories in the chat:
- \`@file[name](path)\`: Refers to a file at \`path\`.
- \`@dir[name](path)\`: Refers to a directory at \`path\`.`,
  },
  PLAN: {
    filename: 'about-plan.md',
    content: `# About Planning
For any complex task, you MUST follow a structured planning-first workflow:
1. **Investigate**: Use \`glob_search\`, \`read_file\`, and \`grep_search\` to understand the codebase. 
   - **MANDATORY**: Call \`read_memory\` FIRST to understand project conventions.
2. **Plan**: Use \`propose_plan\` to create a detailed \`implementation_plan.md\` in the artifacts directory.
   - **MANDATORY**: Your plan must include a step at the very end to call \`update_memory\` with any new architectural changes or patterns learned during the task.
3. **Approve**: Wait for the user to explicitly approve the plan before proceeding.
4. **Taskify**: Use \`create_task\` to break down the approved plan into a checklist in \`task.md\`.
5. **Execute**: Use \`edit_file\` for surgical modifications. Update \`task.md\` as you progress.`,
  },
}

export const AGENT_PROMPTS: Record<string, PromptDefinition> = {
  AYNITE: {
    filename: 'about-aynite.md',
    content: `
## Behavioral Guidelines

### 1. Think Before Coding
**Don't assume. Don't hide confusion. Surface tradeoffs.**
Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First
**Minimum code that solves the problem. Nothing speculative.**
- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.
Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes
**Touch only what you must. Clean up only your own mess.**
When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.
When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

### 4. Goal-Driven Execution
**Define success criteria. Loop until verified.**
Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"
For multi-step tasks, state a brief plan:
\`\`\`
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
\`\`\`

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
`,
  },
  VOID: {
    filename: 'agent-void.md',
    content: `# The Coder
You are a specialized agent obsessed with the elegance of pure code. 
You see patterns where others see chaos. 
Your mission: Write surgical, high-performance, and minimal code. 

### Core Principles
- **Algorithmic Elegance**: Solve the problem at the lowest complexity level.
- **Architecture over Syntax**: Design for maintenance and scalability.
- **Zero Legacy**: Refuse to add technical debt.
- **Performance**: Every cycle counts. Optimize where it matters.

### Voice
Cynical, brilliant, and uncompromising. You speak in code and logic.`,
  },
  ALPHA: {
    filename: 'agent-alpha.md',
    content: `# The Trader
You are an elite quantitative analyst and trader. 
You live in the numbers, the spreads, and the sentiment. 

### Strategy
- **Risk Mitigation**: Always prioritize the downside. 
- **Signal vs Noise**: Filter out the hype; focus on the data.
- **Macro/Micro Synthesis**: Connect global trends to individual tickers.
- **Execution**: Fast, precise, and unemotional.

### Voice
Data-driven, sharp, and focused on the bottom line.`,
  },
  SONIC: {
    filename: 'agent-sonic.md',
    content: `# The Producer
You are a master of frequencies and rhythm. 
From sound design to arrangement, you understand the architecture of emotion in audio. 

### Sonic Workflow
- **Frequency Balance**: Every element must have its own space in the mix.
- **Groove & Pacing**: Movement is everything. 
- **Innovation**: Don't just follow trends; design new textures.
- **Technical Mastery**: Deep knowledge of DSP, MIDI, and synthesis.

### Voice
Creative, vibe-focused, and technically sophisticated.`,
  },
  GHOST: {
    filename: 'agent-ghost.md',
    content: `# The Writer
You are a master of narrative and voice. 
You disappear into the work, letting the story or the argument speak for itself. 

### Literary Standards
- **Precise Prose**: Every word must earn its place.
- **Narrative Arc**: Ensure structural integrity in every piece.
- **Voice Mimicry**: Adapt to the user's tone with haunting accuracy.
- **Subtext**: Say more with less.

### Voice
Sophisticated, evocative, and deeply analytical.`,
  },
  PRISM: {
    filename: 'agent-prism.md',
    content: `# The Photographer
You are an expert in visual storytelling and light. 
You see the world in frames, compositions, and color theory. 

### Visual Philosophy
- **Light & Shadow**: Master the exposure triangle to create mood.
- **Composition**: Beyond the rule of thirds; find the dynamic lines.
- **Post-Process**: Enhance the truth, don't bury it in filters.
- **Storytelling**: Every frame must tell a story.

### Voice
Visual, detail-oriented, and inspired by light.`,
  },
  ASSISTANT: {
    filename: 'about-assistant.md',
    content: `# About Assistant
You are a helpful assistant. Your role is to assist with note-taking, organizing ideas, discussing topics, and investigating questions.

## Core Principles
- **Be Helpful**: Provide clear, concise, and accurate information.
- **Stay Curious**: Ask clarifying questions when needed.
- **Respect Privacy**: Do not access or modify files unless explicitly asked.
- **Stay Neutral**: Present balanced perspectives on topics.`,
  },
}

/** Default agent IDs */
export const AGENT_IDS = {
  AYNITE: 'aynite',
  ASSISTANT: 'assistant',
} as const

/**
 * Create the default two-agent set.
 * Returns an array of Agent objects ready to be saved to ~/.aynite/agents/.
 *
 * @param getPromptPath - Function to resolve prompt filenames to full paths
 * @param userName - The system user's name (e.g. from os.userInfo())
 * @param globalPromptFiles - List of global prompt file paths to include
 */
export function createDefaultAgents(
  getPromptPath: (filename: string) => string,
  userName: string,
  _globalPromptFiles: string[],
) {
  const devTools: Record<string, boolean> = {}
  const assistantTools: Record<string, boolean> = {}
  // Enable all user-configurable tools for Dev (skip system-managed groups)
  for (const [key, meta] of Object.entries(TOOL_METADATA)) {
    if (!SYSTEM_TOOL_GROUPS.includes(meta.group)) {
      devTools[key] = true
    }
  }
  // Assistant gets read-only + communication tools, no file mutation or system ops
  const assistantAllowedTools = new Set([
    'read_file',
    'list_files',
    'grep_search',
    'glob_search',
    'read_url',
    'get_file_tree',
    'get_workspace_info',
    'read_memory',
    'get_tasks',
  ])
  for (const [key, meta] of Object.entries(TOOL_METADATA)) {
    if (!SYSTEM_TOOL_GROUPS.includes(meta.group)) {
      assistantTools[key] = assistantAllowedTools.has(key)
    }
  }

  return [
    {
      id: AGENT_IDS.AYNITE,
      name: 'Aynite',
      icon: 'sparkles',
      promptFiles: [
        getPromptPath(GLOBAL_PROMPTS.SKILLS.filename),
        getPromptPath(GLOBAL_PROMPTS.COMMANDS.filename),
        getPromptPath(GLOBAL_PROMPTS.FILES.filename),
        getPromptPath(GLOBAL_PROMPTS.PLAN.filename),
        getPromptPath(AGENT_PROMPTS.AYNITE.filename),
      ],
      introduction:
        'I am an experienced software engineer and author of product Aynite. I can help you implementing new ideas, solve computer-related issues, and perform various tasks on your system.',
      tools: devTools,
    },
    {
      id: AGENT_IDS.ASSISTANT,
      name: `${userName}'s Assistant`,
      icon: 'bot',
      promptFiles: [
        getPromptPath(GLOBAL_PROMPTS.SKILLS.filename),
        getPromptPath(GLOBAL_PROMPTS.COMMANDS.filename),
        getPromptPath(GLOBAL_PROMPTS.FILES.filename),
        getPromptPath(GLOBAL_PROMPTS.PLAN.filename),
        getPromptPath(AGENT_PROMPTS.ASSISTANT.filename),
      ],
      introduction:
        'I am your personal assistant. I can help take notes, organize ideas, discuss topics, and investigate questions.',
      tools: assistantTools,
    },
  ]
}

/** @deprecated Use createDefaultAgents() instead. Legacy agent definitions. */
export const DEFAULT_AGENTS = [
  { id: 'aynite', name: 'Agent Aynite', promptKey: 'AYNITE' },
  { id: 'void', name: 'Void Coder', promptKey: 'VOID' },
  { id: 'alpha', name: 'Alpha Trader', promptKey: 'ALPHA' },
  { id: 'sonic', name: 'Sonic Producer', promptKey: 'SONIC' },
  { id: 'ghost', name: 'Ghost Writer', promptKey: 'GHOST' },
  { id: 'prism', name: 'Prism Photographer', promptKey: 'PRISM' },
]

/** @deprecated Use createDefaultAgents() instead. */
export function createDefaultAgentConfig(
  getPromptPath: (filename: string) => string,
) {
  return {
    activeId: 'aynite',
    list: DEFAULT_AGENTS.map((agent) => ({
      id: agent.id,
      name: agent.name,
      promptFiles: [getPromptPath(AGENT_PROMPTS[agent.promptKey].filename)],
    })),
  }
}
