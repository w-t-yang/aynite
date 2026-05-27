# AI Chat & Agents

The AI chat is the heart of Aynite. Open the AI Chat view in any tile — it's your interface to AI-powered workflows, tool access, and automation.

---

## Providers

Aynite supports all major AI providers through the Vercel AI SDK — OpenAI, Anthropic, Google, DeepSeek, Ollama, OpenRouter, Groq, Mistral, Azure OpenAI, AWS Bedrock, and more. Pick your preferred provider and use whichever model you like.

> 🙋 **A note from the developer:** As a part-time individual developer, I've personally only tested Gemini, DeepSeek, and Ollama — I don't have subscriptions to every AI provider. If you run into any issues connecting to a provider, I'd greatly appreciate you [reporting it](https://github.com/w-t-yang/aynite/issues). Apologies in advance if some providers don't work out of the box!

### Configuration

1. Open **Settings → AI**
2. Click **Add Provider**
3. Select your provider, enter an API key, and choose a model
4. Set your preferred provider as the **active** one (used for all AI interactions by default)

### Reasoning Effort

For supported providers, you can configure the reasoning/thinking effort level:

| Level | Effect |
|-------|--------|
| **Off** | No reasoning — standard response generation |
| **Low** | Light reasoning for simple analysis |
| **Medium** | Balanced reasoning for most tasks |
| **High** | Deep reasoning for complex problems (uses more tokens) |

Configure this in **Settings → AI** on each provider card.

---

## Sessions

Every chat is a **session** — a persistent conversation that's saved automatically.

### Session Management

- **New Session** — Click the "+" button or type in an empty chat to start a new session
- **Session History** — Browse past sessions from the chat panel sidebar
- **Auto-save** — Sessions are saved to disk as JSON files as you chat (1-second debounce)
- **Sessions are per-workspace** — Each workspace has its own set of sessions

---

## Tool Calls

The AI agent can use tools to interact with your system. When the agent calls a tool, you'll see a collapsible block showing:

1. **Tool name** and primary argument (e.g., `READ FILE  │  src/file.ts`)
2. **Arguments** — The parameters passed to the tool (always visible)
3. **Output/Result** — What the tool returned

### Built-in Tools

| Tool | What It Does |
|------|-------------|
| `read_file` | Read the contents of a file |
| `write_file` | Create or overwrite a file |
| `edit_file` | Make surgical edits to an existing file |
| `list_files` | List files in a directory |
| `grep_search` | Search for patterns across files |
| `glob_search` | Find files matching a pattern |
| `get_file_tree` | See the full directory tree |
| `run_command` | Execute a shell command |
| `read_url` | Fetch and read content from a URL |
| `create_task` | Create a structured task list |
| `update_task` | Update task status |
| `get_tasks` | Read the current task list |
| `propose_plan` | Create a detailed implementation plan |
| `initialize_memory` | Scan the project and create project memory |
| `read_memory` | Read project memory for context |
| `update_memory` | Update project memory with new knowledge |

---

## Running Commands

You can run shell commands directly in the chat with the `>` prefix:

```
> npm run build
```

The agent will execute the command and stream the output in real time. This works for any command you can run in a terminal.

### Command Approval

By default, command execution runs automatically. In **Settings → AI**, you can enable approval mode — commands will pause and ask for confirmation before executing.

---

## Skills

**Skills** are AI-guided workflows that teach the agent how to handle specialized tasks. They're invoked with the `/` prefix.

### Built-in Skills

| Skill | What It Does |
|-------|-------------|
| `/create-theme` | Generate a custom color theme from a description |
| `/create-command` | Create a new command with `COMMAND.md` and `run.sh` |
| `/create-skill` | Create a new skill from scratch or improve an existing one |
| `/create-spell` | Determine whether you need a command or a skill, then delegate to the right creator |
| `/transform-to-dataview` | Transform raw data into a format compatible with Aynite's dataviews |

> 💡 **Tip:** Skills must be discovered by the app. After adding a new skill, press **`Ctrl+R`** to refresh the tile.

### How Skills Work

Skills live in `~/.aynite/skills/` as directories with a `SKILL.md` file. The `SKILL.md` contains instructions that the AI reads when the skill is activated. Skills can include bundled scripts, reference documentation, and assets.

---

## Agents (Spells)

**Agents** (also called spells) are named AI configurations — each with its own system prompt, model selection, and optional tool set. You can have multiple agents:

- **Aynite** — The default agent (general purpose)
- **Alpha** — Fast, concise responses
- **Ghost** — Minimal output, focused on code
- **Prism** — Analytical, detailed reasoning
- **Sonic** — Speed-optimized
- **Void** — Minimal agent for simple tasks

Configure agents in **Settings → Agents**.
