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

### Step 1: Set Up Your AI Provider

Before the AI agent can help you, it needs a model to work with.

1. Open **Settings** (gear icon in the sidebar)
2. Go to the **AI** tab
3. Click **Add Provider** and select your provider:
   - **OpenAI**, **Anthropic**, **Google**, **DeepSeek**, **Ollama**, OpenRouter, Groq, Mistral, Azure, Bedrock, and more
4. Enter your API key and pick a model
5. That's it — you're ready to chat

> 🙋 **A note from the developer:** As a part-time individual developer, I've personally only tested Gemini, DeepSeek, and Ollama — I don't have subscriptions to every AI provider. If you run into any issues connecting to a provider, I'd greatly appreciate you [reporting it](https://github.com/w-t-yang/aynite/issues). Apologies in advance if some providers don't work out of the box!

> 💡 **Prefer local?** Install [Ollama](https://ollama.ai), pull a model like `llama3.1`, and point Aynite to `http://localhost:11434`. No API key, no cloud — everything stays on your machine.

---

### Step 2: Try Your First Chat

Open the AI chat (click the chat view or add it to a tile) and type:

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

Then go to **Settings → Appearance** and select your brand new theme.

---

### Step 3: Create Your First Dataview

One of the most powerful features in Aynite is turning raw data into interactive visualizations — charts, graphs, mind maps, and more.

**Aynite is different from other AI tools:** skills aren't automatically loaded into the agent's tool list. You have to explicitly tell the AI which skill to use by typing `/` in the chat and selecting the skill from the dropdown. This keeps the agent focused and avoids unnecessary tool clutter.

Try this in the AI chat — start by typing `/` and select the **transform-to-dataview** skill, then type your request:

```
/transform-to-dataview

I have a few tasks to track:
- Design the landing page
- Build the API
- Write tests
- Deploy to production

Can you turn this into a mind map so I can visualize the workflow?
```

The AI agent will:
1. Use the **transform-to-dataview** skill you explicitly selected
2. Help you pick the right visualization type (mind map, flow chart, graph, etc.)
3. Transform your data into a ready-to-use JSON file
4. Save it right next to your source file

You can also use it with files and folders — just mention a file path or paste your data and the agent will guide you through the process.

---

### Step 4: Open and Edit a File

The **File Browser** is your main workspace view. It works like a file tree on the left with file content on the right.

1. Click any file in the tree view to open it in a tab
2. Click the **Edit** button at the bottom of the file to toggle edit mode
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