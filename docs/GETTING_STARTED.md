# Getting Started with Aynite

Welcome! This guide will take you from zero to your first AI-powered workflow in about five minutes.

---

## Installation

1. **Download** the latest release from the [releases page](https://github.com/w-t-yang/aynite/releases)
2. **Open** the `.zip` file and drag `Aynite.app` to your Applications folder
3. **Launch** Aynite

> 🚧 **macOS only for now.** Windows and Linux builds are available but not yet distributed as pre-built binaries. See the [Developer Guide](DEVELOPER.md#building) to build from source.

---

## First Steps

### The Three Shortcuts to Burn Into Muscle Memory

| Shortcut | What It Does |
|----------|--------------|
| **`Ctrl+I`** | Open the AI chat panel — the magic key |
| **`Ctrl+Tab`** | Fuzzy-find and switch files |
| **`Ctrl+Shift+R`** | Reload the app (after adding skills, themes, or config changes) |

> 💡 On macOS, use `Cmd` instead of `Ctrl` throughout.

---

### Step 1: Set Up Your AI Provider

Before the AI agent can help you, it needs a model to work with.

1. Open **Settings** (gear icon in the sidebar or press `Ctrl+,`)
2. Go to the **AI** tab
3. Click **Add Provider** and select your provider:
   - **OpenAI** — GPT-4o, o1, o3-mini
   - **Anthropic** — Claude 3.5 Sonnet, Claude Opus
   - **Google** — Gemini 2.0 Flash, Gemini Pro
   - **DeepSeek** — DeepSeek Reasoning
   - **Ollama** — Run models locally (fully offline)
   - OpenRouter, Groq, Mistral, Azure, Bedrock, and more
4. Enter your API key and pick a model
5. That's it — you're ready to chat

> 💡 **Prefer local?** Install [Ollama](https://ollama.ai), pull a model like `llama3.1`, and point Aynite to `http://localhost:11434`. No API key, no cloud — everything stays on your machine.

---

### Step 2: Try Your First Chat

Press **`Ctrl+I`** to open the chat panel. Try typing:

```
Hello! What can you do?
```

The AI agent will respond with an overview of its capabilities. Now try something more interesting:

```
/create-theme make me a deep ocean theme with bioluminescent accents
```

The agent will:
1. Activate the `create-theme` skill
2. Generate a complete theme file with all 32 color properties
3. Save it to your themes folder

Press **`Ctrl+Shift+R`** to reload the app, then go to **Settings → Appearance** and select your brand new theme.

---

### Step 3: Run Your First Command

**Commands** are deterministic scripts that run on your system. They're prefixed with `>` in the chat.

Try this:

```
> echo "Hello from Aynite!"
```

You'll see the output directly in the chat. Commands can be anything — shell scripts, Python programs, Node scripts, curl calls to any API.

---

### Step 4: Open and Edit a File

The **File Browser** is your main workspace view. It works like a file tree on the left with file content on the right.

1. Click any file in the tree view to open it in a tab
2. Press **`Ctrl+E`** to toggle edit mode
3. Make your changes and press **`Ctrl+S`** to save
4. Press **`Ctrl+F`** to search within the file
5. Use **`Ctrl+N`** and **`Ctrl+P`** to jump between matches

---

## Next Steps

Now that you're up and running, here's what to explore next:

| Guide | What You'll Learn |
|-------|-------------------|
| [Working with Files](guides/WORKING_WITH_FILES.md) | File browser, tabs, modes, search — in depth |
| [AI Chat & Agents](guides/AI_CHAT_AND_AGENTS.md) | Sessions, providers, tool calls, skills |
| [Git Integration](guides/GIT_INTEGRATION.md) | Track changes, view diffs, commit with AI |
| [Data Visualization](guides/DATA_VISUALIZATION.md) | Transform any data into interactive visualizations |
| [Customization](guides/CUSTOMIZATION.md) | Themes, keybindings, settings |
| [Extending Aynite](guides/EXTENDING_AYNITE.md) | Create your own skills, commands, and views |
| [Workspaces & Layout](guides/WORKSPACES_AND_LAYOUT.md) | Multiple workspaces, tile layouts, multi-window |
| [Integrations](guides/INTEGRATIONS.md) | RSS reader, Spotify |
